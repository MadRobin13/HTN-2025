const { ipcRenderer } = require('electron');
const { marked } = require('marked');
const path = require('path');

// Monaco Editor will be loaded dynamically
let monaco;

class VoiceDevApp {
  constructor() {
    this.currentProject = null;
    this.isRecording = false;
    this.recognition = null;
    this.synthesis = null;
    this.conversationHistory = [];
    this.openFiles = new Map(); // filepath -> { editor, content, modified }
    this.activeFile = null;
    this.originalContents = new Map(); // for diff tracking
    
    this.initializeElements();
    this.initializeMonacoEditor();
    this.initializeSpeechAPIs();
    this.setupEventListeners();
    this.setupIpcListeners();
  }

  initializeElements() {
    // Main elements
    this.projectInfo = document.getElementById('projectInfo');
    this.openProjectBtn = document.getElementById('openProjectBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.fileTree = document.getElementById('fileTree');
    this.chatMessages = document.getElementById('chatMessages');
    this.messageInput = document.getElementById('messageInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.voiceBtn = document.getElementById('voiceBtn');
    this.voiceIndicator = document.getElementById('voiceIndicator');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.voiceStatus = document.getElementById('voiceStatus');
    
    // Editor elements
    this.editorTabs = document.getElementById('editorTabs');
    this.editorWelcome = document.getElementById('editorWelcome');
    this.monacoContainer = document.getElementById('monacoContainer');
    this.diffViewer = document.getElementById('diffViewer');
    this.diffContent = document.getElementById('diffContent');
    this.diffSideBySide = document.getElementById('diffSideBySide');
    this.diffOriginal = document.getElementById('diffOriginal');
    this.diffModified = document.getElementById('diffModified');
    this.saveFileBtn = document.getElementById('saveFileBtn');
    this.diffViewBtn = document.getElementById('diffViewBtn');
    this.diffModeBtn = document.getElementById('diffModeBtn');
    this.applyChangesBtn = document.getElementById('applyChangesBtn');
    this.clearChatBtn = document.getElementById('clearChatBtn');
    
    // Diff viewer state
    this.diffMode = 'unified'; // 'unified' or 'side-by-side'
    
    // Terminal elements
    this.terminalBtn = document.getElementById('terminalBtn');
    this.terminalPanel = document.getElementById('terminalPanel');
    this.terminalContent = document.getElementById('terminalContent');
    this.closeTerminalBtn = document.getElementById('closeTerminalBtn');
    this.clearTerminalBtn = document.getElementById('clearTerminalBtn');
    
    // Code editor toggle
    this.codeEditorBtn = document.getElementById('codeEditorBtn');
    this.editorSection = document.getElementById('editorSection');
    this.editorChatContainer = document.querySelector('.editor-chat-container');
    this.isEditorVisible = false;
    
    // Terminal state
    this.currentTerminal = null;
    this.terminalBuffer = '';
    
    // Recent changes
    this.recentChanges = document.getElementById('recentChanges');
  }

  initializeSpeechAPIs() {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isRecording = true;
        this.voiceBtn.classList.add('recording');
        this.voiceIndicator.classList.add('active');
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.messageInput.value = transcript;
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.voiceBtn.classList.remove('recording');
        this.voiceIndicator.classList.remove('active');
        
        if (this.messageInput.value.trim()) {
          this.sendMessage();
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.isRecording = false;
        this.voiceBtn.classList.remove('recording');
        this.voiceIndicator.classList.remove('active');
      };

      this.voiceStatus.textContent = 'Ready';
      this.voiceStatus.style.color = '#10b981';
    } else {
      this.voiceStatus.textContent = 'Not Supported';
      this.voiceStatus.style.color = '#ef4444';
      this.voiceBtn.disabled = true;
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  async initializeMonacoEditor() {
    try {
      // Use simple fallback editor instead of Monaco
      console.log('Using fallback editor instead of Monaco');
      this.initializeFallbackEditor();
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      this.initializeFallbackEditor();
    }
  }

  initializeFallbackEditor() {
    // Create a simple code editor container
    const container = document.getElementById('monacoContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="fallback-editor">
        <div class="editor-toolbar">
          <span class="file-info" id="currentFileInfo">No file open</span>
          <div class="editor-controls">
            <select id="languageSelect" class="language-selector">
              <option value="plaintext">Plain Text</option>
              <option value="javascript">JavaScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="python">Python</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
        </div>
        <textarea id="codeEditor" class="code-textarea" spellcheck="false" wrap="off"></textarea>
        <div class="editor-status">
          <span id="editorStatus">Ready</span>
          <span id="cursorPosition">Line 1, Column 1</span>
        </div>
      </div>
    `;

    // Initialize the fallback editor
    this.codeEditor = document.getElementById('codeEditor');
    this.currentFileInfo = document.getElementById('currentFileInfo');
    this.languageSelect = document.getElementById('languageSelect');
    this.editorStatus = document.getElementById('editorStatus');
    this.cursorPosition = document.getElementById('cursorPosition');

    // Add event listeners
    this.setupFallbackEditorEvents();
    
    // Mark as initialized
    this.editorInitialized = true;
  }

  setupFallbackEditorEvents() {
    if (!this.codeEditor) return;

    // Track cursor position
    this.codeEditor.addEventListener('keyup', () => this.updateCursorPosition());
    this.codeEditor.addEventListener('mouseup', () => this.updateCursorPosition());

    // Handle tab key for indentation
    this.codeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.codeEditor.selectionStart;
        const end = this.codeEditor.selectionEnd;
        const value = this.codeEditor.value;
        
        this.codeEditor.value = value.substring(0, start) + '  ' + value.substring(end);
        this.codeEditor.selectionStart = this.codeEditor.selectionEnd = start + 2;
      }
    });

    // Language selector
    if (this.languageSelect) {
      this.languageSelect.addEventListener('change', () => {
        const language = this.languageSelect.value;
        this.codeEditor.className = `code-textarea language-${language}`;
      });
    }
  }

  updateCursorPosition() {
    if (!this.codeEditor || !this.cursorPosition) return;
    
    const textBeforeCursor = this.codeEditor.value.substring(0, this.codeEditor.selectionStart);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    this.cursorPosition.textContent = `Line ${line}, Column ${column}`;
  }

  setupEventListeners() {
    // Project management
    this.openProjectBtn.addEventListener('click', () => this.openProject());
    
    // Message input
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.messageInput.addEventListener('input', () => {
      this.autoResizeTextarea();
    });

    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Voice controls
    this.voiceBtn.addEventListener('mousedown', () => this.startRecording());
    this.voiceBtn.addEventListener('mouseup', () => this.stopRecording());
    this.voiceBtn.addEventListener('mouseleave', () => this.stopRecording());

    // Editor controls
    this.saveFileBtn.addEventListener('click', () => this.saveCurrentFile());
    this.diffViewBtn.addEventListener('click', () => this.toggleDiffView());
    this.diffModeBtn.addEventListener('click', () => this.toggleDiffMode());
    this.applyChangesBtn.addEventListener('click', () => this.applyChanges());
    this.clearChatBtn.addEventListener('click', () => this.clearChat());
    this.codeEditorBtn.addEventListener('click', () => this.toggleCodeEditor());
    
    // Terminal controls
    this.terminalBtn.addEventListener('click', () => this.toggleTerminal());
    this.closeTerminalBtn.addEventListener('click', () => this.closeTerminal());
    this.clearTerminalBtn.addEventListener('click', () => this.clearTerminal());

    // Settings
    this.settingsBtn.addEventListener('click', () => this.openSettings());
  }

  setupIpcListeners() {
    // File system events
    ipcRenderer.on('file-added', (event, filePath) => {
      console.log('File added:', filePath);
      this.refreshFileTree();
    });

    ipcRenderer.on('file-changed', (event, filePath) => {
      console.log('File changed:', filePath);
    });

    ipcRenderer.on('file-removed', (event, filePath) => {
      console.log('File removed:', filePath);
      this.refreshFileTree();
    });

    // Terminal IPC listeners
    ipcRenderer.on('terminal-data', (event, terminalId, data) => {
      if (this.currentTerminal === terminalId) {
        this.appendTerminalOutput(data);
      }
    });

    ipcRenderer.on('terminal-exit', (event, terminalId, exitCode) => {
      if (this.currentTerminal === terminalId) {
        this.appendTerminalOutput(`\n\nProcess exited with code: ${exitCode}\n`);
        this.currentTerminal = null;
      }
    });
  }

  toggleCodeEditor() {
    this.isEditorVisible = !this.isEditorVisible;
    
    if (this.isEditorVisible) {
      this.editorSection.style.display = 'flex';
      this.editorChatContainer.classList.remove('editor-hidden');
      this.editorChatContainer.style.flexDirection = 'row'; // Ensure side-by-side layout
    } else {
      this.editorSection.style.display = 'none';
      this.editorChatContainer.classList.add('editor-hidden');
      this.editorChatContainer.style.flexDirection = 'column'; // Reset to column when hidden
    }
    
    // Update button appearance
    this.codeEditorBtn.classList.toggle('active', this.isEditorVisible);
  }

  async openProject() {
    this.showLoading('Opening project...');
    
    try {
      const result = await ipcRenderer.invoke('open-project');
      
      if (result.success) {
        this.currentProject = { path: result.path };
        this.updateProjectInfo(result.path);
        this.renderFileTree(result.files, result.structure);
        this.addSystemMessage(`Project opened: ${result.path}`);
        
        // Get project explanation from Gemini
        const explanation = await ipcRenderer.invoke('gemini-explain-project', result.structure, result.files);
        if (explanation.success) {
          this.addAssistantMessage(explanation.explanation, 'gemini');
        }
      }
    } catch (error) {
      console.error('Error opening project:', error);
      this.addSystemMessage('Error opening project: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  updateProjectInfo(projectPath) {
    this.currentProject = { path: projectPath };
    const projectName = projectPath.split('/').pop().split('\\').pop();
    this.projectInfo.innerHTML = `
      <span class="project-name">${projectName}</span>
      <small>${projectPath}</small>
    `;
  }

  renderFileTree(files, structure) {
    if (!files || files.length === 0) {
      this.fileTree.innerHTML = '<div class="empty-state"><p>No files found</p></div>';
      return;
    }

    const treeHtml = this.buildFileTreeHtml(structure);
    this.fileTree.innerHTML = treeHtml;

    // Add click handlers for files
    this.fileTree.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.dataset.path;
        if (filePath) {
          this.openFileInEditor(filePath);
        }
      });
    });
  }

  buildFileTreeHtml(structure, basePath = '') {
    let html = '';
    
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = basePath ? `${basePath}/${name}` : name;
      
      if (typeof content === 'object' && content.type === 'file') {
        html += `
          <div class="file-item" data-path="${fullPath}">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>${name}</span>
          </div>
        `;
      } else if (typeof content === 'object' && !content.type) {
        html += `
          <div class="folder-item">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none">
              <path d="M3 7V5C3 3.89543 3.89543 3 5 3H9L11 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>${name}</span>
          </div>
          <div class="folder-children">
            ${this.buildFileTreeHtml(content, fullPath)}
          </div>
        `;
      }
    }
    
    return html;
  }

  async openFileInEditor(filePath) {
    try {
      if (this.openFiles.has(filePath)) {
        this.switchToFile(filePath);
        return;
      }
      
      // Convert relative path to absolute path using current project path
      let absolutePath;
      if (this.currentProject && !require('path').isAbsolute(filePath)) {
        absolutePath = require('path').join(this.currentProject.path, filePath);
      } else {
        absolutePath = filePath;
      }
      
      // Normalize path separators
      const normalizedPath = absolutePath.replace(/[\/\\]/g, require('path').sep);
      
      const result = await ipcRenderer.invoke('read-file', normalizedPath);
      if (result.success) {
        this.createEditorTab(normalizedPath, result.content);
        this.originalContents.set(normalizedPath, result.content);
        this.addRecentChange(normalizedPath, 'opened');
      } else {
        // Check if it's a binary file or unsupported type
        if (result.error.includes('EBUSY') || result.error.includes('EPERM')) {
          this.addSystemMessage(`Cannot open file: Access denied to ${filePath}`, 'error');
        } else if (result.error.includes('ENOENT')) {
          this.addSystemMessage(`File not found: ${filePath}`, 'error');
        } else {
          // Try to determine if it's a binary file
          const fileExtension = filePath.split('.').pop().toLowerCase();
          const textFileExtensions = ['txt', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'md', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'xml', 'yml', 'yaml', 'sql', 'sh', 'bat', 'ps1'];
          
          if (textFileExtensions.includes(fileExtension)) {
            this.addSystemMessage(`Error opening file: ${result.error}`, 'error');
          } else {
            this.addSystemMessage(`Cannot open file: ${filePath} (Unsupported file type)`, 'info');
          }
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
      this.addSystemMessage(`Error opening file: ${error.message}`, 'error');
    }
  }
  
  createEditorTab(filePath, content) {
    // Use fallback editor instead of Monaco
    if (!this.editorInitialized) {
      console.error('Fallback editor not initialized');
      return;
    }
    
    const fileName = filePath.split(/[\/\\]/).pop();
    const language = this.getLanguageFromFile(fileName);
    
    // Hide welcome screen and show editor
    this.editorWelcome.style.display = 'none';
    this.monacoContainer.style.display = 'block';
    
    // Set editor content and language
    if (this.codeEditor) {
      this.codeEditor.value = content;
      this.languageSelect.value = language;
      this.codeEditor.className = `code-textarea language-${language}`;
      this.currentFileInfo.textContent = fileName;
    }
    
    // Track file changes
    if (this.codeEditor && !this.codeEditor.hasChangeListener) {
      this.codeEditor.addEventListener('input', () => {
        this.markFileAsModified(filePath);
        this.updateRecentChanges(filePath, 'modified');
      });
      this.codeEditor.hasChangeListener = true;
    }
    
    // Store file data
    this.openFiles.set(filePath, {
      editor: this.codeEditor,
      content: content,
      modified: false
    });
    
    this.activeFile = filePath;
    this.updateEditorTabs();
    this.updateEditorActions();
    this.updateCursorPosition();
  }
  
  getLanguageFromFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust'
    };
    return languageMap[ext] || 'plaintext';
  }
  
  switchToFile(filePath) {
    if (!this.openFiles.has(filePath)) return;
    
    // Hide current editor
    if (this.activeFile && this.openFiles.has(this.activeFile)) {
      this.openFiles.get(this.activeFile).editor.getContainerDomNode().style.display = 'none';
    }
    
    // Show target editor
    const fileData = this.openFiles.get(filePath);
    fileData.editor.getContainerDomNode().style.display = 'block';
    fileData.editor.layout();
    
    this.activeFile = filePath;
    this.updateEditorTabs();
    this.updateEditorActions();
  }
  
  updateEditorTabs() {
    if (this.openFiles.size === 0) {
      this.editorTabs.innerHTML = '<div class="tab-placeholder">No files open</div>';
      return;
    }
    
    const tabsHtml = Array.from(this.openFiles.keys()).map(filePath => {
      const fileName = filePath.split('/').pop();
      const isActive = filePath === this.activeFile;
      const isModified = this.openFiles.get(filePath).modified;
      
      return `
        <div class="editor-tab ${isActive ? 'active' : ''} ${isModified ? 'modified' : ''}" data-path="${filePath}">
          <span>${fileName}</span>
          <div class="tab-close" data-path="${filePath}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
        </div>
      `;
    }).join('');
    
    this.editorTabs.innerHTML = tabsHtml;
    
    // Add event listeners
    this.editorTabs.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
          this.switchToFile(tab.dataset.path);
        }
      });
    });
    
    this.editorTabs.querySelectorAll('.tab-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeFile(closeBtn.dataset.path);
      });
    });
  }
  
  closeFile(filePath) {
    if (!this.openFiles.has(filePath)) return;
    
    const fileData = this.openFiles.get(filePath);
    
    // Check if file is modified
    if (fileData.modified) {
      const shouldSave = confirm(`${filePath.split('/').pop()} has unsaved changes. Save before closing?`);
      if (shouldSave) {
        this.saveFile(filePath);
      }
    }
    
    // Dispose editor
    fileData.editor.dispose();
    this.openFiles.delete(filePath);
    
    // Switch to another file or show welcome
    if (filePath === this.activeFile) {
      const remainingFiles = Array.from(this.openFiles.keys());
      if (remainingFiles.length > 0) {
        this.switchToFile(remainingFiles[0]);
      } else {
        this.activeFile = null;
        this.editorWelcome.style.display = 'flex';
        this.monacoContainer.style.display = 'none';
      }
    }
    
    this.updateEditorTabs();
    this.updateEditorActions();
  }
  
  markFileAsModified(filePath) {
    if (this.openFiles.has(filePath)) {
      this.openFiles.get(filePath).modified = true;
      this.updateEditorTabs();
      this.updateEditorActions();
    }
  }
  
  updateEditorActions() {
    const hasActiveFile = this.activeFile && this.openFiles.has(this.activeFile);
    const isModified = hasActiveFile && this.openFiles.get(this.activeFile).modified;
    
    this.saveFileBtn.disabled = !isModified;
    this.diffViewBtn.disabled = !hasActiveFile;
  }
  
  async saveCurrentFile() {
    if (!this.activeFile || !this.openFiles.has(this.activeFile)) return;
    
    await this.saveFile(this.activeFile);
  }
  
  async saveFile(filePath) {
    try {
      const fileData = this.openFiles.get(filePath);
      // Get content from fallback editor instead of Monaco
      const content = this.codeEditor ? this.codeEditor.value : fileData.content;
      
      const result = await ipcRenderer.invoke('write-file', filePath, content);
      if (result.success) {
        fileData.modified = false;
        fileData.content = content;
        this.originalContents.set(filePath, content);
        this.updateEditorTabs();
        this.updateEditorActions();
        this.addSystemMessage(`Saved: ${filePath.split('/').pop()}`, 'success');
        this.addRecentChange(filePath, 'saved');
      } else {
        this.addSystemMessage(`Error saving file: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      this.addSystemMessage(`Error saving file: ${error.message}`, 'error');
    }
  }
  
  toggleDiffView() {
    if (!this.activeFile) return;
    
    const isVisible = this.diffViewer.style.display !== 'none';
    
    if (isVisible) {
      this.diffViewer.style.display = 'none';
      this.monacoContainer.style.display = 'block';
    } else {
      this.showDiffView();
    }
  }
  
  showDiffView() {
    if (!this.activeFile || !this.openFiles.has(this.activeFile)) return;
    
    const fileData = this.openFiles.get(this.activeFile);
    const currentContent = fileData.editor.getValue();
    const originalContent = this.originalContents.get(this.activeFile) || '';
    
    if (this.diffMode === 'unified') {
      const diff = this.generateDiff(originalContent, currentContent);
      this.diffContent.innerHTML = diff;
      this.diffContent.style.display = 'block';
      this.diffSideBySide.style.display = 'none';
    } else {
      this.generateSideBySideDiff(originalContent, currentContent);
      this.diffContent.style.display = 'none';
      this.diffSideBySide.style.display = 'flex';
    }
    
    this.monacoContainer.style.display = 'none';
    this.diffViewer.style.display = 'block';
  }

  toggleDiffMode() {
    this.diffMode = this.diffMode === 'unified' ? 'side-by-side' : 'unified';
    
    // Update button icon
    const icon = this.diffModeBtn.querySelector('svg');
    if (this.diffMode === 'side-by-side') {
      icon.innerHTML = `
        <rect x="3" y="3" width="18" height="18" rx="1" stroke="currentColor" stroke-width="2"/>
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
      `;
      this.diffModeBtn.title = 'Switch to Unified View';
    } else {
      icon.innerHTML = `
        <rect x="3" y="3" width="7" height="18" rx="1" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="3" width="7" height="18" rx="1" stroke="currentColor" stroke-width="2"/>
      `;
      this.diffModeBtn.title = 'Switch to Side-by-Side View';
    }
    
    // Refresh diff view if it's currently visible
    if (this.diffViewer.style.display !== 'none') {
      this.showDiffView();
    }
  }

  generateSideBySideDiff(original, current) {
    this.diffOriginal.textContent = original;
    this.diffModified.textContent = current;
    
    // Add styling classes
    this.diffOriginal.className = 'diff-pane-content original';
    this.diffModified.className = 'diff-pane-content modified';
  }
  
  generateDiff(original, current) {
    const originalLines = original.split('\n');
    const currentLines = current.split('\n');
    
    let diffHtml = '';
    const maxLines = Math.max(originalLines.length, currentLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const currentLine = currentLines[i] || '';
      
      if (originalLine === currentLine) {
        diffHtml += `<div class="diff-line context">${this.escapeHtml(currentLine)}</div>`;
      } else {
        if (originalLine) {
          diffHtml += `<div class="diff-line removed">- ${this.escapeHtml(originalLine)}</div>`;
        }
        if (currentLine) {
          diffHtml += `<div class="diff-line added">+ ${this.escapeHtml(currentLine)}</div>`;
        }
      }
    }
    
    return diffHtml || '<div class="diff-line context">No changes</div>';
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  applyChanges() {
    if (!this.activeFile) return;
    
    this.saveCurrentFile();
    this.toggleDiffView();
  }
  
  addRecentChange(filePath, type) {
    const fileName = filePath.split('/').pop();
    const changeItem = document.createElement('div');
    changeItem.className = 'change-item';
    changeItem.innerHTML = `
      <div class="change-type ${type}"></div>
      <span>${fileName}</span>
      <small>${type}</small>
    `;
    
    // Add to top of recent changes
    const firstChild = this.recentChanges.firstChild;
    if (firstChild && firstChild.classList && firstChild.classList.contains('empty-state')) {
      this.recentChanges.innerHTML = '';
    }
    
    this.recentChanges.insertBefore(changeItem, this.recentChanges.firstChild);
    
    // Keep only last 10 changes
    while (this.recentChanges.children.length > 10) {
      this.recentChanges.removeChild(this.recentChanges.lastChild);
    }
  }
  
  updateRecentChanges(filePath, type) {
    // Debounce updates to avoid spam
    clearTimeout(this.updateRecentChangesTimeout);
    this.updateRecentChangesTimeout = setTimeout(() => {
      this.addRecentChange(filePath, type);
    }, 1000);
  }
  
  clearChat() {
    this.chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M21 15A2 2 0 0 1 19 17H7L4 20V6A2 2 0 0 1 6 4H19A2 2 0 0 1 21 6V15Z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <h4>Ready to help with your code!</h4>
        <p>Ask me to generate, review, or explain code. I can see your current files and changes.</p>
      </div>
    `;
    this.conversationHistory = [];
  }
  
  toggleTerminal() {
    const isVisible = this.terminalPanel.style.display !== 'none';
    
    if (isVisible) {
      this.closeTerminal();
    } else {
      this.terminalPanel.style.display = 'block';
      this.initializeTerminal();
    }
  }
  
  closeTerminal() {
    this.terminalPanel.style.display = 'none';
  }
  
  clearTerminal() {
    this.terminalContent.innerHTML = '';
  }
  
  async initializeTerminal() {
    try {
      const cwd = this.currentProject ? this.currentProject.path : process.cwd();
      const result = await ipcRenderer.invoke('terminal-create', cwd);
      
      if (result.success) {
        this.currentTerminal = result.terminalId;
        this.terminalContent.innerHTML = '';
        this.appendTerminalOutput('Terminal ready. Type commands and press Enter.\n');
        this.setupTerminalInput();
      } else {
        this.appendTerminalOutput(`Error creating terminal: ${result.error}\n`);
      }
    } catch (error) {
      this.appendTerminalOutput(`Error initializing terminal: ${error.message}\n`);
    }
  }

  setupTerminalInput() {
    // Create input element for terminal
    const inputContainer = document.createElement('div');
    inputContainer.className = 'terminal-input-container';
    inputContainer.innerHTML = `
      <span class="terminal-prompt">$ </span>
      <input type="text" class="terminal-input" placeholder="Enter command..." />
    `;
    
    this.terminalContent.appendChild(inputContainer);
    
    const input = inputContainer.querySelector('.terminal-input');
    input.focus();
    
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const command = input.value.trim();
        if (command && this.currentTerminal) {
          // Echo command
          this.appendTerminalOutput(`$ ${command}\n`);
          
          // Send command to terminal
          await ipcRenderer.invoke('terminal-write', this.currentTerminal, command + '\n');
          
          // Clear input
          input.value = '';
        }
      }
    });
  }

  appendTerminalOutput(data) {
    // Remove input container temporarily
    const inputContainer = this.terminalContent.querySelector('.terminal-input-container');
    if (inputContainer) {
      inputContainer.remove();
    }
    
    // Append output
    const outputElement = document.createElement('span');
    outputElement.textContent = data;
    outputElement.style.whiteSpace = 'pre-wrap';
    this.terminalContent.appendChild(outputElement);
    
    // Re-add input container
    if (this.currentTerminal) {
      this.setupTerminalInput();
    }
    
    // Scroll to bottom
    this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
  }

  async refreshFileTree() {
    if (this.currentProject) {
      const context = await ipcRenderer.invoke('get-project-context');
      if (context) {
        this.renderFileTree(context.files, context.structure);
      }
    }
  }

  startRecording() {
    if (this.recognition && !this.isRecording) {
      this.recognition.start();
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message) return;

    this.addUserMessage(message);
    this.messageInput.value = '';
    this.autoResizeTextarea();
    this.showLoading('Processing...');

    try {
      // Determine if this is a code-related request
      const isCodeRequest = this.isCodeRelatedMessage(message);
      let response;

      // Get enhanced context including current file
      const context = await this.getEnhancedContext();
      
      if (isCodeRequest) {
        response = await this.handleCodeRequest(message, context);
      } else {
        response = await ipcRenderer.invoke('gemini-chat', message, context);
      }

      if (response.success) {
        const modelUsed = response.model || 'gemini-pro';
        this.addAssistantMessage(response.response || response.code || response.explanation || response.review || response.refactoredCode || response.debugInfo, modelUsed);
        
        // Speak the response if synthesis is available
        // Apply code changes if generated
        if (response.code && this.activeFile) {
          this.applyGeneratedCode(response.code);
        }
        
        this.speakResponse(response.response || response.explanation || 'Code generated successfully');
      } else {
        this.addSystemMessage('Error: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.addSystemMessage('Error processing message: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  isCodeRelatedMessage(message) {
    const codeKeywords = [
      'generate', 'create', 'write', 'code', 'function', 'class', 'component',
      'refactor', 'debug', 'fix', 'review', 'optimize', 'explain code',
      'implement', 'build', 'develop', 'programming', 'script'
    ];
    
    return codeKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  async handleCodeRequest(message, context) {
    // Determine the type of code request
    if (message.toLowerCase().includes('generate') || message.toLowerCase().includes('create') || message.toLowerCase().includes('write')) {
      return await ipcRenderer.invoke('gemini-generate-code', message, 'javascript', context);
    } else if (message.toLowerCase().includes('review')) {
      return await ipcRenderer.invoke('gemini-review-code', '', 'javascript', 'general');
    } else if (message.toLowerCase().includes('debug') || message.toLowerCase().includes('fix')) {
      return await ipcRenderer.invoke('gemini-debug-code', '', 'javascript', null, message);
    } else if (message.toLowerCase().includes('refactor')) {
      return await ipcRenderer.invoke('gemini-refactor-code', '', 'javascript', message);
    } else if (message.toLowerCase().includes('explain code')) {
      return await ipcRenderer.invoke('gemini-explain-code', '', 'javascript');
    } else {
      // Default to Gemini chat for code-related questions
      return await ipcRenderer.invoke('gemini-chat', message, context);
    }
  }

  addUserMessage(message) {
    const messageElement = this.createMessageElement(message, 'user');
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  addAssistantMessage(message, model = 'assistant') {
    const messageElement = this.createMessageElement(message, 'assistant', model);
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  addSystemMessage(message, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `system-message ${type}`;
    messageElement.innerHTML = `
      <div class="system-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  createMessageElement(content, sender, model = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (sender === 'user') {
      avatar.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
    } else {
      const modelIcon = '🤖'; // Always Gemini now
      avatar.innerHTML = `<span style="font-size: 16px;">${modelIcon}</span>`;
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse markdown for assistant messages
    if (sender === 'assistant') {
      contentDiv.innerHTML = marked.parse(content);
    } else {
      contentDiv.textContent = content;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
  }

  speakResponse(text) {
    if (this.synthesis && text) {
      // Cancel any ongoing speech
      this.synthesis.cancel();
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      // Speak
      this.synthesis.speak(utterance);
    }
  }

  autoResizeTextarea() {
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  showLoading(message = 'Loading...') {
    this.loadingOverlay.querySelector('p').textContent = message;
    this.loadingOverlay.classList.add('show');
  }

  hideLoading() {
    this.loadingOverlay.classList.remove('show');
  }

  async getEnhancedContext() {
    const baseContext = await ipcRenderer.invoke('get-project-context');
    
    // Add current file information
    if (this.activeFile && this.openFiles.has(this.activeFile)) {
      const fileData = this.openFiles.get(this.activeFile);
      const currentContent = fileData.editor.getValue();
      
      baseContext.currentFile = {
        path: this.activeFile,
        content: currentContent,
        language: this.getLanguageFromFile(this.activeFile.split('/').pop()),
        modified: fileData.modified
      };
      
      // Add recent changes context
      const recentChanges = Array.from(this.recentChanges.children)
        .filter(child => !child.classList.contains('empty-state'))
        .slice(0, 5)
        .map(child => ({
          file: child.querySelector('span').textContent,
          type: child.querySelector('small').textContent
        }));
      
      baseContext.recentChanges = recentChanges;
    }
    
    return baseContext;
  }
  
  openSettings() {
    this.addSystemMessage('Settings panel coming soon!');
  }

  applyGeneratedCode(code) {
    if (!this.activeFile || !this.openFiles.has(this.activeFile)) {
      // Create new file dialog or show code in chat
      this.showCodePreview(code);
      return;
    }
    
    const shouldApply = confirm('Apply the generated code to the current file?');
    if (shouldApply) {
      const fileData = this.openFiles.get(this.activeFile);
      fileData.editor.setValue(code);
      this.markFileAsModified(this.activeFile);
      this.addSystemMessage('Code applied to current file', 'success');
    }
  }
  
  showCodePreview(code) {
    // Show code in a formatted way in chat
    const codeElement = document.createElement('div');
    codeElement.className = 'message assistant';
    codeElement.innerHTML = `
      <div class="message-avatar">
        <span style="font-size: 16px;">🤖</span>
      </div>
      <div class="message-content">
        <p>Generated code:</p>
        <pre><code>${this.escapeHtml(code)}</code></pre>
        <button class="btn-secondary btn-small" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">
          Copy to Clipboard
        </button>
      </div>
    `;
    
    this.chatMessages.appendChild(codeElement);
    this.scrollToBottom();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new VoiceDevApp();
});
