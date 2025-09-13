const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { spawn, exec } = require('child_process');
const os = require('os');
require('dotenv').config();

const GeminiService = require('./services/gemini');
const GeminiCodeService = require('./services/claude');

class StratosphereApp {
  constructor() {
    this.mainWindow = null;
    this.currentProject = null;
    this.fileWatcher = null;
    this.geminiService = new GeminiService();
    this.geminiCodeService = new GeminiCodeService();
    this.terminals = new Map(); // Store active terminal sessions
    this.recentProjectsPath = path.join(os.homedir(), '.stratosphere', 'recent-projects.json');
    this.initializeAppData();
  }

  initializeAppData() {
    const appDataDir = path.join(os.homedir(), '.stratosphere');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    if (!fs.existsSync(this.recentProjectsPath)) {
      fs.writeFileSync(this.recentProjectsPath, JSON.stringify([]));
    }
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
      backgroundColor: '#0a0a0f',
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
    // Create new project
    ipcMain.handle('create-project', async (event, projectData) => {
      try {
        const { name, location, template } = projectData;
        const projectPath = path.join(location, name);
        
        // Create project directory
        if (!fs.existsSync(projectPath)) {
          fs.mkdirSync(projectPath, { recursive: true });
        }
        
        // Initialize based on template
        await this.initializeProjectTemplate(projectPath, template, name);
        
        // Add to recent projects
        await this.addToRecentProjects({
          name,
          path: projectPath,
          createdAt: new Date().toISOString(),
          template
        });
        
        this.currentProject = projectPath;
        this.watchProject(this.currentProject);
        const files = await this.getProjectFiles(this.currentProject);
        const structure = await this.getProjectStructure(this.currentProject);
        
        return {
          success: true,
          path: this.currentProject,
          files,
          structure
        };
      } catch (error) {
        console.error('Error creating project:', error);
        return { success: false, error: error.message };
      }
    });

    // Open existing project folder
    ipcMain.handle('open-project', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        this.currentProject = result.filePaths[0];
        
        // Add to recent projects
        await this.addToRecentProjects({
          name: path.basename(this.currentProject),
          path: this.currentProject,
          openedAt: new Date().toISOString()
        });
        
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

    // Load specific project from recent projects
    ipcMain.handle('load-project', async (event, projectPath) => {
      try {
        if (!fs.existsSync(projectPath)) {
          throw new Error('Project directory no longer exists');
        }
        
        this.currentProject = projectPath;
        
        // Update recent projects (move to top)
        await this.addToRecentProjects({
          name: path.basename(this.currentProject),
          path: this.currentProject,
          openedAt: new Date().toISOString()
        });
        
        this.watchProject(this.currentProject);
        const files = await this.getProjectFiles(this.currentProject);
        const structure = await this.getProjectStructure(this.currentProject);
        
        return {
          success: true,
          path: this.currentProject,
          files,
          structure
        };
      } catch (error) {
        console.error('Error loading project:', error);
        return { success: false, error: error.message };
      }
    });

    // Get recent projects
    ipcMain.handle('get-recent-projects', async () => {
      try {
        const data = fs.readFileSync(this.recentProjectsPath, 'utf8');
        const projects = JSON.parse(data);
        
        // Filter out projects that no longer exist
        const validProjects = projects.filter(project => fs.existsSync(project.path));
        
        // If we filtered out any, update the file
        if (validProjects.length !== projects.length) {
          fs.writeFileSync(this.recentProjectsPath, JSON.stringify(validProjects, null, 2));
        }
        
        return { success: true, projects: validProjects };
      } catch (error) {
        console.error('Error getting recent projects:', error);
        return { success: true, projects: [] };
      }
    });

    // GitHub clone repository
    ipcMain.handle('github-clone', async (event, repoUrl, destinationPath) => {
      return new Promise((resolve) => {
        const gitCommand = `git clone ${repoUrl} "${destinationPath}"`;
        
        exec(gitCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('Git clone error:', error);
            resolve({ success: false, error: error.message });
            return;
          }
          
          // Add cloned project to recent projects
          this.addToRecentProjects({
            name: path.basename(destinationPath),
            path: destinationPath,
            clonedAt: new Date().toISOString(),
            source: 'github',
            repoUrl
          }).then(() => {
            resolve({ success: true, path: destinationPath });
          }).catch(() => {
            resolve({ success: true, path: destinationPath }); // Still successful even if recent projects update fails
          });
        });
      });
    });

    // Browse for directory
    ipcMain.handle('browse-directory', async (event, title = 'Select Directory') => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openDirectory'],
          title: title
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, path: result.filePaths[0] };
        }
        return { success: false };
      } catch (error) {
        console.error('Error browsing directory:', error);
        return { success: false, error: error.message };
      }
    });

    // Get project templates
    ipcMain.handle('get-project-templates', async () => {
      return {
        success: true,
        templates: [
          { id: 'blank', name: 'Blank Project', description: 'Start with an empty project' },
          { id: 'web', name: 'Web Application', description: 'HTML, CSS, and JavaScript starter' },
          { id: 'node', name: 'Node.js Project', description: 'Node.js with package.json' },
          { id: 'react', name: 'React App', description: 'Create React App template' },
          { id: 'vue', name: 'Vue.js App', description: 'Vue CLI template' },
          { id: 'python', name: 'Python Project', description: 'Python with virtual environment' }
        ]
      };
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
        // Try to read as UTF-8 text first
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        // If UTF-8 reading fails, check if it's a binary file
        try {
          // Try to read first few bytes to determine if it's binary
          const buffer = fs.readFileSync(filePath);
          const isBinary = buffer.toString('utf8').includes('\uFFFD') || 
                          !buffer.toString('utf8').trim() ||
                          buffer.length > 1024 * 1024; // 1MB limit
          
          if (isBinary) {
            return { success: false, error: 'Binary file - not supported for direct editing' };
          } else {
            // Try with different encoding
            const content = fs.readFileSync(filePath, 'latin1');
            return { success: true, content };
          }
        } catch (readError) {
          return { success: false, error: readError.message };
        }
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
      let shell, shellArgs;
      
      if (os.platform() === 'win32') {
        // Use PowerShell on Windows
        shell = 'powershell.exe';
        shellArgs = ['-NoExit', '-Command', '-'];
      } else {
        shell = process.env.SHELL || 'bash';
        shellArgs = [];
      }
      
      const terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const childProcess = spawn(shell, shellArgs, {
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

      // Handle process errors
      childProcess.on('error', (error) => {
        console.error('Terminal process error:', error);
        this.terminals.delete(terminalId);
        if (this.mainWindow) {
          this.mainWindow.webContents.send('terminal-error', terminalId, error.message);
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

  async initializeProjectTemplate(projectPath, template, projectName) {
    switch (template) {
      case 'web':
        // Create basic web structure
        fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Welcome to ${projectName}</h1>
    <script src="script.js"></script>
</body>
</html>`);
        fs.writeFileSync(path.join(projectPath, 'style.css'), `body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
    text-align: center;
}`);
        fs.writeFileSync(path.join(projectPath, 'script.js'), `// Welcome to ${projectName}
console.log('Hello, ${projectName}!');`);
        break;
        
      case 'node':
        // Create Node.js project
        const packageJson = {
          name: projectName.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          description: '',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            test: 'echo "Error: no test specified" && exit 1'
          },
          keywords: [],
          author: '',
          license: 'ISC'
        };
        fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        fs.writeFileSync(path.join(projectPath, 'index.js'), `// Welcome to ${projectName}
console.log('Hello, ${projectName}!');

// Your code here`);
        fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${projectName}

Description of your project.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\``);
        break;
        
      case 'python':
        // Create Python project
        fs.writeFileSync(path.join(projectPath, 'main.py'), `#!/usr/bin/env python3
"""${projectName}

Main entry point for the application.
"""

def main():
    print(f"Welcome to ${projectName}!")

if __name__ == "__main__":
    main()`);
        fs.writeFileSync(path.join(projectPath, 'requirements.txt'), '# Add your dependencies here\n');
        fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${projectName}

Description of your Python project.

## Installation

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Usage

\`\`\`bash
python main.py
\`\`\``);
        break;
        
      default:
        // Blank project - just create README
        fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${projectName}

Your project description here.`);
    }
    
    // Create .gitignore
    const gitignore = `# Dependencies
node_modules/
__pycache__/
*.pyc

# Environment
.env
.venv/
venv/

# Build outputs
dist/
build/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db`;
    fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);
  }

  async addToRecentProjects(projectData) {
    try {
      const data = fs.readFileSync(this.recentProjectsPath, 'utf8');
      let projects = JSON.parse(data);
      
      // Remove existing entry if it exists (to avoid duplicates)
      projects = projects.filter(p => p.path !== projectData.path);
      
      // Add new entry at the beginning
      projects.unshift(projectData);
      
      // Keep only the last 10 projects
      projects = projects.slice(0, 10);
      
      fs.writeFileSync(this.recentProjectsPath, JSON.stringify(projects, null, 2));
    } catch (error) {
      console.error('Error updating recent projects:', error);
    }
  }
}

const app_instance = new StratosphereApp();

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
