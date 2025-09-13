const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const os = require('os');
require('dotenv').config();

const GeminiService = require('./services/gemini');
const GeminiCodeService = require('./services/claude');

class VoiceDevAssistant {
  constructor() {
    this.mainWindow = null;
    this.currentProject = null;
    this.fileWatcher = null;
    this.geminiService = new GeminiService();
    this.geminiCodeService = new GeminiCodeService();
    this.terminals = new Map(); // Store active terminal sessions
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#0f0f23',
      show: false,
      icon: path.join(__dirname, '../assets/icon.png')
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      if (this.fileWatcher) {
        this.fileWatcher.close();
      }
    });

    // Development tools
    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  setupIpcHandlers() {
    // Open project folder
    ipcMain.handle('open-project', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        this.currentProject = result.filePaths[0];
        this.watchProject(this.currentProject);
        const files = await this.getProjectFiles(this.currentProject);
        const structure = await this.getProjectStructure(this.currentProject);
        
        return {
          success: true,
          path: this.currentProject,
          files,
          structure
        };
      }
      return { success: false };
    });

    // Get project context
    ipcMain.handle('get-project-context', async () => {
      if (!this.currentProject) return null;
      
      return {
        path: this.currentProject,
        files: await this.getProjectFiles(this.currentProject),
        structure: await this.getProjectStructure(this.currentProject)
      };
    });

    // Read file content
    ipcMain.handle('read-file', async (event, filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Write file content
    ipcMain.handle('write-file', async (event, filePath, content) => {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Gemini chat
    ipcMain.handle('gemini-chat', async (event, message, context) => {
      return await this.geminiService.sendMessage(message, context);
    });

    // Gemini code analysis
    ipcMain.handle('gemini-analyze-code', async (event, code, language, question) => {
      return await this.geminiService.analyzeCode(code, language, question);
    });

    // Gemini project explanation
    ipcMain.handle('gemini-explain-project', async (event, structure, files) => {
      return await this.geminiService.explainProject(structure, files);
    });

    // Gemini Code Service endpoints
    ipcMain.handle('gemini-generate-code', async (event, prompt, language, context) => {
      return await this.geminiCodeService.generateCode(prompt, language, context);
    });

    ipcMain.handle('gemini-review-code', async (event, code, language, reviewType) => {
      return await this.geminiCodeService.reviewCode(code, language, reviewType);
    });

    ipcMain.handle('gemini-refactor-code', async (event, code, language, instructions) => {
      return await this.geminiCodeService.refactorCode(code, language, instructions);
    });

    ipcMain.handle('gemini-debug-code', async (event, code, language, error, description) => {
      return await this.geminiCodeService.debugCode(code, language, error, description);
    });

    ipcMain.handle('gemini-explain-code', async (event, code, language) => {
      return await this.geminiCodeService.explainCode(code, language);
    });

    // Terminal management
    ipcMain.handle('terminal-create', async (event, cwd) => {
      return this.createTerminal(cwd);
    });

    ipcMain.handle('terminal-write', async (event, terminalId, data) => {
      return this.writeToTerminal(terminalId, data);
    });

    ipcMain.handle('terminal-resize', async (event, terminalId, cols, rows) => {
      return this.resizeTerminal(terminalId, cols, rows);
    });

    ipcMain.handle('terminal-kill', async (event, terminalId) => {
      return this.killTerminal(terminalId);
    });

    // Get conversation history
    ipcMain.handle('get-conversation-history', async () => {
      return this.geminiService.getConversationHistory();
    });

    // Clear conversation history
    ipcMain.handle('clear-conversation-history', async () => {
      this.geminiService.clearHistory();
      return { success: true };
    });
  }

  async getProjectFiles(projectPath) {
    const files = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.nyc_output'];
    const excludeFiles = ['.DS_Store', 'Thumbs.db', '.env'];
    
    const walkDir = (dir, relativePath = '') => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          if (excludeFiles.includes(item)) continue;
          
          const fullPath = path.join(dir, item);
          const relPath = path.join(relativePath, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !excludeDirs.includes(item) && !item.startsWith('.')) {
            walkDir(fullPath, relPath);
          } else if (stat.isFile() && !item.startsWith('.')) {
            files.push({
              name: item,
              path: fullPath,
              relativePath: relPath,
              size: stat.size,
              modified: stat.mtime,
              extension: path.extname(item).toLowerCase()
            });
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    };

    walkDir(projectPath);
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  async getProjectStructure(projectPath) {
    const structure = {};
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.nyc_output'];
    
    const buildStructure = (dir, obj) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          if (item.startsWith('.') && item !== '.env.example') continue;
          
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            obj[item] = {};
            buildStructure(fullPath, obj[item]);
          } else if (stat.isFile()) {
            obj[item] = {
              type: 'file',
              size: stat.size,
              extension: path.extname(item).toLowerCase()
            };
          }
        }
      } catch (error) {
        console.error(`Error building structure for ${dir}:`, error);
      }
    };

    buildStructure(projectPath, structure);
    return structure;
  }

  watchProject(projectPath) {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    this.fileWatcher = chokidar.watch(projectPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    this.fileWatcher
      .on('add', (path) => {
        this.mainWindow.webContents.send('file-added', path);
      })
      .on('change', (path) => {
        this.mainWindow.webContents.send('file-changed', path);
      })
      .on('unlink', (path) => {
        this.mainWindow.webContents.send('file-removed', path);
      });
  }

  createTerminal(cwd = process.cwd()) {
    try {
      const shell = os.platform() === 'win32' ? 'cmd' : 'bash';
      const terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const childProcess = spawn(shell, [], {
        cwd: cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store the terminal process
      this.terminals.set(terminalId, childProcess);

      // Handle terminal output
      childProcess.stdout.on('data', (data) => {
        if (this.mainWindow) {
          this.mainWindow.webContents.send('terminal-data', terminalId, data.toString());
        }
      });

      childProcess.stderr.on('data', (data) => {
        if (this.mainWindow) {
          this.mainWindow.webContents.send('terminal-data', terminalId, data.toString());
        }
      });

      // Handle terminal exit
      childProcess.on('exit', (exitCode) => {
        this.terminals.delete(terminalId);
        if (this.mainWindow) {
          this.mainWindow.webContents.send('terminal-exit', terminalId, exitCode);
        }
      });

      return {
        success: true,
        terminalId: terminalId,
        pid: childProcess.pid
      };
    } catch (error) {
      console.error('Error creating terminal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  writeToTerminal(terminalId, data) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (terminal && terminal.stdin) {
        terminal.stdin.write(data);
        return { success: true };
      } else {
        return { success: false, error: 'Terminal not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  resizeTerminal(terminalId, cols, rows) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (terminal) {
        // Note: Basic child_process doesn't support resize like node-pty
        // This is a placeholder for compatibility
        return { success: true };
      } else {
        return { success: false, error: 'Terminal not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  killTerminal(terminalId) {
    try {
      const terminal = this.terminals.get(terminalId);
      if (terminal) {
        terminal.kill('SIGTERM');
        this.terminals.delete(terminalId);
        return { success: true };
      } else {
        return { success: false, error: 'Terminal not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const app_instance = new VoiceDevAssistant();

app.whenReady().then(() => {
  app_instance.createWindow();
  app_instance.setupIpcHandlers();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      app_instance.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
