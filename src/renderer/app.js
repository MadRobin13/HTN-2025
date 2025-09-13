const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

class StratosphereApp {
  constructor() {
    this.currentProject = null;
    this.recentProjects = this.loadRecentProjects();
    this.currentScreen = 'welcome'; // 'welcome', 'project'
    this.folderStates = new Map(); // Track folder open/closed states
    this.openFiles = new Map(); // Track opened files
    this.activeFileTab = null;
    this.fileViewerVisible = false;
    this.chatVisible = false;
    this.chatHistory = [];
    this.isTyping = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupIpcListeners();
    this.renderRecentProjects();
  }

  initializeElements() {
    // Welcome screen elements
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.newProjectCard = document.getElementById('newProjectCard');
    this.openProjectCard = document.getElementById('openProjectCard');
    this.githubCloneCard = document.getElementById('githubCloneCard');
    this.recentList = document.getElementById('recentList');
    
    // Modal elements
    this.newProjectModal = document.getElementById('newProjectModal');
    this.githubModal = document.getElementById('githubModal');
    this.rocketAnimation = document.getElementById('rocketAnimation');
    
    // Project view elements
    this.projectView = document.getElementById('projectView');
    this.backToWelcome = document.getElementById('backToWelcome');
    this.currentProjectName = document.getElementById('currentProjectName');
    this.currentProjectPath = document.getElementById('currentProjectPath');
    this.fileTree = document.getElementById('fileTree');
    
    // File viewer elements
    this.toggleFileViewerBtn = document.getElementById('toggleFileViewerBtn');
    this.fileViewerPanel = document.getElementById('fileViewerPanel');
    this.closeFileViewerBtn = document.getElementById('closeFileViewerBtn');
    this.fileViewerTabs = document.getElementById('fileViewerTabs');
    this.fileViewerContent = document.getElementById('fileViewerContent');
    
    // Chat elements
    this.openChatBtn = document.getElementById('openChatBtn');
    this.chatPanel = document.getElementById('chatPanel');
    this.closeChatBtn = document.getElementById('closeChatBtn');
    this.clearChatBtn = document.getElementById('clearChatBtn');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendChatBtn = document.getElementById('sendChatBtn');
    
    // Form elements
    this.newProjectForm = document.getElementById('newProjectForm');
    this.githubCloneForm = document.getElementById('githubCloneForm');
    
    // Loading overlay
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
  }

  setupEventListeners() {
    // Welcome screen action cards
    this.newProjectCard?.addEventListener('click', () => this.showNewProjectModal());
    this.openProjectCard?.addEventListener('click', () => this.openExistingProject());
    this.githubCloneCard?.addEventListener('click', () => this.showGithubModal());
    
    // Modal close buttons
    document.getElementById('closeNewProjectModal')?.addEventListener('click', () => this.hideNewProjectModal());
    document.getElementById('closeGithubModal')?.addEventListener('click', () => this.hideGithubModal());
    
    // Form submissions
    this.newProjectForm?.addEventListener('submit', (e) => this.handleNewProjectSubmit(e));
    this.githubCloneForm?.addEventListener('submit', (e) => this.handleGithubCloneSubmit(e));
    
    // Browse buttons
    document.getElementById('browseProjectPath')?.addEventListener('click', () => this.browseProjectPath());
    document.getElementById('browseCloneLocation')?.addEventListener('click', () => this.browseCloneLocation());
    
    // Cancel buttons
    document.getElementById('cancelNewProject')?.addEventListener('click', () => this.hideNewProjectModal());
    document.getElementById('cancelClone')?.addEventListener('click', () => this.hideGithubModal());
    
    // Project view navigation
    this.backToWelcome?.addEventListener('click', () => this.showWelcomeScreen());
    
    // File viewer controls
    this.toggleFileViewerBtn?.addEventListener('click', () => this.toggleFileViewer());
    this.closeFileViewerBtn?.addEventListener('click', () => this.hideFileViewer());
    
    // Chat controls
    this.openChatBtn?.addEventListener('click', () => this.showChat());
    this.closeChatBtn?.addEventListener('click', () => this.hideChat());
    this.clearChatBtn?.addEventListener('click', () => this.clearChat());
    this.sendChatBtn?.addEventListener('click', () => this.sendMessage());
    
    // Chat input handling
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Auto-resize chat input
    this.chatInput?.addEventListener('input', () => this.autoResizeTextarea());
    
    // Chat suggestions
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('chat-suggestion') || e.target.classList.contains('chat-suggestion-fullscreen')) {
        const suggestion = e.target.dataset.suggestion;
        if (suggestion && this.chatInput) {
          this.chatInput.value = suggestion;
          this.autoResizeTextarea();
          this.chatInput.focus();
        }
      }
    });
    
    // Modal backdrop clicks
    this.newProjectModal?.addEventListener('click', (e) => {
      if (e.target === this.newProjectModal) this.hideNewProjectModal();
    });
    this.githubModal?.addEventListener('click', (e) => {
      if (e.target === this.githubModal) this.hideGithubModal();
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideNewProjectModal();
        this.hideGithubModal();
      }
    });
  }

  setupIpcListeners() {
    // Basic IPC listeners for file operations
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
  }

  // Recent Projects Management
  loadRecentProjects() {
    try {
      const stored = localStorage.getItem('stratosphere-recent-projects');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading recent projects:', error);
      return [];
    }
  }

  saveRecentProjects() {
    try {
      localStorage.setItem('stratosphere-recent-projects', JSON.stringify(this.recentProjects));
    } catch (error) {
      console.error('Error saving recent projects:', error);
    }
  }

  addToRecentProjects(projectPath, projectName) {
    const existingIndex = this.recentProjects.findIndex(p => p.path === projectPath);
    if (existingIndex >= 0) {
      this.recentProjects.splice(existingIndex, 1);
    }

    this.recentProjects.unshift({
      name: projectName,
      path: projectPath,
      lastOpened: new Date().toISOString()
    });

    // Keep only the last 10 projects
    this.recentProjects = this.recentProjects.slice(0, 10);
    this.saveRecentProjects();
    this.renderRecentProjects();
  }

  async renderRecentProjects() {
    if (!this.recentList) return;

    try {
      const result = await ipcRenderer.invoke('get-recent-projects');
      if (result && result.success) {
        this.recentProjects = result.projects || [];
      }
    } catch (e) {
      console.warn('Could not load recent projects from main process:', e.message);
      this.recentProjects = [];
    }

    if (!this.recentProjects || this.recentProjects.length === 0) {
      this.recentList.innerHTML = `
        <div class="empty-recent">
          <p>No recent projects yet</p>
          <small>Projects you open will appear here</small>
        </div>
      `;
      return;
    }

    this.recentList.innerHTML = this.recentProjects.map(project => {
      // Handle different timestamp fields
      const timestamp = project.lastOpened || project.openedAt || project.createdAt || project.clonedAt;
      const timeAgo = timestamp ? this.getTimeAgo(new Date(timestamp)) : 'Unknown';
      return `
        <div class="recent-project-item" data-path="${project.path}">
          <div class="recent-project-info">
            <h5>${project.name}</h5>
            <p>${project.path}</p>
          </div>
          <div class="recent-project-time">${timeAgo}</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    this.recentList.querySelectorAll('.recent-project-item').forEach(item => {
      item.addEventListener('click', async () => {
        const projectPath = item.dataset.path;
        this.showRocketAnimation();
        try {
          const result = await ipcRenderer.invoke('load-project', projectPath);
          if (result.success) {
            setTimeout(() => {
              this.hideRocketAnimation();
              this.openProject(result.path, result.files, result.structure);
              this.renderRecentProjects(); // Refresh recent projects
            }, 3500);
          } else {
            this.hideRocketAnimation();
            this.showError('Failed to load project: ' + result.error);
          }
        } catch (error) {
          console.error('Error loading project:', error);
          this.hideRocketAnimation();
          this.showError('Failed to load project');
        }
      });
    });
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  // Modal Management
  showNewProjectModal() {
    this.newProjectModal?.classList.remove('hidden');
    document.getElementById('projectName')?.focus();
  }

  hideNewProjectModal() {
    this.newProjectModal?.classList.add('hidden');
    this.newProjectForm?.reset();
  }

  showGithubModal() {
    this.githubModal?.classList.remove('hidden');
    document.getElementById('githubUrl')?.focus();
  }

  hideGithubModal() {
    this.githubModal?.classList.add('hidden');
    this.githubCloneForm?.reset();
  }

  // Project Operations
  async openExistingProject() {
    try {
      this.showRocketAnimation();
      const result = await ipcRenderer.invoke('open-project');
      if (result.success) {
        // Wait for animation to complete
        setTimeout(() => {
          this.hideRocketAnimation();
          this.openProject(result.path, result.files, result.structure);
          this.renderRecentProjects(); // Refresh recent projects
        }, 3500);
      } else {
        this.hideRocketAnimation();
      }
    } catch (error) {
      console.error('Error opening project:', error);
      this.hideRocketAnimation();
      this.showError('Failed to open project');
    }
  }

  async handleNewProjectSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectName = formData.get('projectName') || document.getElementById('projectName')?.value;
    const projectPath = formData.get('projectPath') || document.getElementById('projectPath')?.value;
    const projectType = formData.get('projectType') || document.getElementById('projectType')?.value;

    if (!projectName || !projectPath) {
      this.showError('Please fill in all required fields');
      return;
    }

    this.hideNewProjectModal();
    await this.createNewProject(projectName, projectPath, projectType);
  }

  async createNewProject(name, location, type) {
    try {
      this.showRocketAnimation();
      
      // Template types now match main.js directly
      const template = type || 'blank';
      
      const result = await ipcRenderer.invoke('create-project', {
        name,
        location,
        template
      });

      if (result.success) {
        // Wait for animation to complete
        setTimeout(() => {
          this.hideRocketAnimation();
          this.openProject(result.path, result.files, result.structure);
          this.renderRecentProjects(); // Refresh recent projects
        }, 3500);
      } else {
        this.hideRocketAnimation();
        this.showError('Failed to create project: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      this.hideRocketAnimation();
      this.showError('Failed to create project');
    }
  }

  async handleGithubCloneSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const githubUrl = formData.get('githubUrl') || document.getElementById('githubUrl')?.value;
    const cloneLocation = formData.get('cloneLocation') || document.getElementById('cloneLocation')?.value;

    if (!githubUrl || !cloneLocation) {
      this.showError('Please fill in all required fields');
      return;
    }

    this.hideGithubModal();
    await this.cloneFromGithub(githubUrl, cloneLocation);
  }

  async cloneFromGithub(url, location) {
    try {
      this.showRocketAnimation();
      
      // Extract repo name from URL
      const repoName = url.split('/').pop().replace('.git', '');
      const destinationPath = path.join(location, repoName);
      
      const result = await ipcRenderer.invoke('github-clone', url, destinationPath);

      if (result.success) {
        setTimeout(() => {
          this.hideRocketAnimation();
          this.openProject(result.path);
          this.renderRecentProjects(); // Refresh recent projects
        }, 3500);
      } else {
        this.hideRocketAnimation();
        this.showError('Failed to clone repository: ' + result.error);
      }
    } catch (error) {
      console.error('Error cloning repository:', error);
      this.hideRocketAnimation();
      this.showError('Failed to clone repository');
    }
  }

  async browseProjectPath() {
    try {
      const result = await ipcRenderer.invoke('browse-directory', 'Select Project Location');
      if (result.success) {
        const pathInput = document.getElementById('projectPath');
        if (pathInput) pathInput.value = result.path;
      }
    } catch (error) {
      console.error('Error browsing for directory:', error);
      this.showError('Failed to open directory browser');
    }
  }

  async browseCloneLocation() {
    try {
      const result = await ipcRenderer.invoke('browse-directory', 'Select Clone Location');
      if (result.success) {
        const pathInput = document.getElementById('cloneLocation');
        if (pathInput) pathInput.value = result.path;
      }
    } catch (error) {
      console.error('Error browsing for directory:', error);
      this.showError('Failed to open directory browser');
    }
  }

  // Animation Management
  showRocketAnimation() {
    this.rocketAnimation?.classList.remove('hidden');
  }

  hideRocketAnimation() {
    this.rocketAnimation?.classList.add('hidden');
  }

  // Screen Navigation
  showWelcomeScreen() {
    this.currentScreen = 'welcome';
    this.welcomeScreen?.classList.remove('hidden');
    this.projectView?.classList.add('hidden');
    this.currentProject = null;
    this.renderRecentProjects(); // Refresh recent projects when returning to welcome
  }

  showProjectScreen() {
    this.currentScreen = 'project';
    this.welcomeScreen?.classList.add('hidden');
    this.projectView?.classList.remove('hidden');
  }

  async openProject(projectPath, files = null, structure = null) {
    const projectName = path.basename(projectPath);
    
    // Update current project info
    this.currentProject = {
      name: projectName,
      path: projectPath
    };

    // Update project info in UI
    if (this.currentProjectName) this.currentProjectName.textContent = projectName;
    if (this.currentProjectPath) this.currentProjectPath.textContent = projectPath;

    // Load project files if not provided
    if (!files || !structure) {
      await this.loadProjectFiles(projectPath);
    } else {
      this.renderFileTree(files, structure);
    }

    // Switch to project view
    this.showProjectScreen();
  }

  async loadProjectFiles(projectPath) {
    try {
      // Ensure main process knows which project to load
      const loadResult = await ipcRenderer.invoke('load-project', projectPath);
      if (loadResult && loadResult.success) {
        this.renderFileTree(loadResult.files, loadResult.structure);
      } else {
        // Fallback to context if already set
        const result = await ipcRenderer.invoke('get-project-context');
        if (result && result.files) {
          this.renderFileTree(result.files, result.structure);
        }
      }
    } catch (error) {
      console.error('Error loading project files:', error);
    }
  }

  renderFileTree(files, structure) {
    if (!this.fileTree) return;

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
          this.openFileInViewer(filePath);
        }
      });
    });

    // Add click handlers for folder headers
    this.fileTree.querySelectorAll('.folder-header').forEach(header => {
      header.addEventListener('click', () => {
        const folderItem = header.closest('.folder-item');
        const folderPath = folderItem.dataset.folderPath;
        if (folderPath) {
          this.toggleFolder(folderPath);
        }
      });
    });
  }

  buildFileTreeHtml(structure, basePath = '') {
    let html = '';
    
    for (const [name, content] of Object.entries(structure || {})) {
      const fullPath = basePath ? path.join(basePath, name) : name;
      
      if (typeof content === 'object' && content.type === 'file') {
        // Create absolute file path for reading
        const absolutePath = this.currentProject ? path.join(this.currentProject.path, fullPath) : fullPath;
        html += `
          <div class="file-item" data-path="${absolutePath}" data-relative-path="${fullPath}">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>${name}</span>
          </div>
        `;
      } else if (typeof content === 'object' && !content.type) {
        const isCollapsed = this.folderStates.get(fullPath) === 'collapsed';
        html += `
          <div class="folder-item" data-folder-path="${fullPath}">
            <div class="folder-header">
              <svg class="folder-toggle ${isCollapsed ? 'collapsed' : ''}" viewBox="0 0 24 24" fill="none">
                <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2"/>
              </svg>
              <svg class="file-icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 7V5C3 3.89543 3.89543 3 5 3H9L11 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>${name}</span>
            </div>
            <div class="folder-children ${isCollapsed ? 'collapsed' : ''}">
              ${this.buildFileTreeHtml(content, fullPath)}
            </div>
          </div>
        `;
      }
    }
    
    return html;
  }

  async refreshFileTree() {
    if (this.currentProject) {
      await this.loadProjectFiles(this.currentProject.path);
    }
  }

  // Folder folding functionality
  toggleFolder(folderPath) {
    const currentState = this.folderStates.get(folderPath);
    const newState = currentState === 'collapsed' ? 'expanded' : 'collapsed';
    this.folderStates.set(folderPath, newState);
    
    // Find the folder item and update its state
    const folderItem = this.fileTree.querySelector(`[data-folder-path="${folderPath}"]`);
    if (folderItem) {
      const toggle = folderItem.querySelector('.folder-toggle');
      const children = folderItem.querySelector('.folder-children');
      
      if (newState === 'collapsed') {
        toggle?.classList.add('collapsed');
        children?.classList.add('collapsed');
      } else {
        toggle?.classList.remove('collapsed');
        children?.classList.remove('collapsed');
      }
    }
  }

  // File viewer functionality
  toggleFileViewer() {
    if (this.fileViewerVisible) {
      this.hideFileViewer();
    } else {
      this.showFileViewer();
    }
  }

  showFileViewer() {
    if (this.fileViewerPanel) {
      this.fileViewerPanel.classList.remove('hidden');
      this.fileViewerVisible = true;
    }
  }

  hideFileViewer() {
    if (this.fileViewerPanel) {
      this.fileViewerPanel.classList.add('hidden');
      this.fileViewerVisible = false;
    }
  }

  async openFileInViewer(filePath) {
    try {
      // Show file viewer if hidden
      this.showFileViewer();
      
      // Ensure we have an absolute path
      let absolutePath = filePath;
      if (!path.isAbsolute(filePath) && this.currentProject) {
        absolutePath = path.resolve(this.currentProject.path, filePath);
      }
      
      console.log('Opening file:', absolutePath);
      
      // Get file content from main process
      const result = await ipcRenderer.invoke('read-file', absolutePath);
      if (!result.success) {
        console.error('File read error:', result.error);
        this.showError('Failed to read file: ' + result.error);
        return;
      }

      // Add file tab if not already open
      const fileName = path.basename(absolutePath);
      if (!this.openFiles.has(absolutePath)) {
        this.openFiles.set(absolutePath, {
          name: fileName,
          path: absolutePath,
          content: result.content,
          type: this.getFileType(absolutePath)
        });
        this.addFileTab(absolutePath, fileName);
      }

      // Switch to this file
      this.switchToFile(absolutePath);
    } catch (error) {
      console.error('Error opening file:', error);
      this.showError('Failed to open file: ' + error.message);
    }
  }

  addFileTab(filePath, fileName) {
    if (!this.fileViewerTabs) return;

    const tab = document.createElement('div');
    tab.className = 'file-tab';
    tab.dataset.filePath = filePath;
    tab.innerHTML = `
      <span>${fileName}</span>
      <svg class="file-tab-close" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;

    // Add click handler for tab
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.file-tab-close')) {
        this.closeFileTab(filePath);
      } else {
        this.switchToFile(filePath);
      }
    });

    this.fileViewerTabs.appendChild(tab);
  }

  switchToFile(filePath) {
    // Update active tab
    this.fileViewerTabs?.querySelectorAll('.file-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filePath === filePath);
    });

    this.activeFileTab = filePath;
    this.renderFileContent(filePath);
  }

  closeFileTab(filePath) {
    // Remove from open files
    this.openFiles.delete(filePath);
    
    // Remove tab element - escape path for CSS selector
    const tab = Array.from(this.fileViewerTabs?.querySelectorAll('.file-tab') || []).find(
      tab => tab.dataset.filePath === filePath
    );
    tab?.remove();

    // If this was the active tab, switch to another or show empty state
    if (this.activeFileTab === filePath) {
      const remainingTabs = this.fileViewerTabs?.querySelectorAll('.file-tab');
      if (remainingTabs && remainingTabs.length > 0) {
        const nextTab = remainingTabs[0];
        this.switchToFile(nextTab.dataset.filePath);
      } else {
        this.activeFileTab = null;
        this.renderEmptyFileViewer();
      }
    }
  }

  renderFileContent(filePath) {
    if (!this.fileViewerContent) return;

    const fileData = this.openFiles.get(filePath);
    if (!fileData) return;

    const fileInfo = `
      <div class="file-info">
        <h4>${fileData.name}</h4>
        <p><strong>Path:</strong> ${fileData.path}</p>
        <p><strong>Type:</strong> ${fileData.type}</p>
      </div>
    `;

    if (this.isImageFile(filePath)) {
      // Display image - handle Windows paths
      let imageSrc = fileData.path;
      if (process.platform === 'win32') {
        imageSrc = 'file:///' + fileData.path.replace(/\\/g, '/');
      } else {
        imageSrc = 'file://' + fileData.path;
      }
      this.fileViewerContent.innerHTML = fileInfo + `
        <img src="${imageSrc}" alt="${fileData.name}" onerror="this.style.display='none'; this.nextSibling.style.display='block';">
        <div style="display:none; text-align:center; color:var(--gray-500); padding:2rem;">Failed to load image</div>
      `;
    } else if (this.isTextFile(filePath)) {
      // Display text content
      this.fileViewerContent.innerHTML = fileInfo + `
        <pre><code>${this.escapeHtml(fileData.content)}</code></pre>
      `;
    } else {
      // Unsupported file type
      this.fileViewerContent.innerHTML = fileInfo + `
        <div class="no-file-selected">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
          </svg>
          <p>File type not supported for preview</p>
        </div>
      `;
    }
  }

  renderEmptyFileViewer() {
    if (!this.fileViewerContent) return;
    
    this.fileViewerContent.innerHTML = `
      <div class="no-file-selected">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
        </svg>
        <p>Select a file to view its contents</p>
      </div>
    `;
  }

  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
      return 'Image';
    } else if (['.txt', '.md', '.js', '.ts', '.html', '.css', '.json', '.xml', '.yml', '.yaml'].includes(ext)) {
      return 'Text';
    }
    return 'Unknown';
  }

  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext);
  }

  isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.txt', '.md', '.js', '.ts', '.html', '.css', '.json', '.xml', '.yml', '.yaml', '.py', '.java', '.cpp', '.c', '.h'].includes(ext);
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Chat functionality
  showChat() {
    if (this.chatPanel && document.getElementById('workspaceArea')) {
      // Hide the workspace area
      document.getElementById('workspaceArea').style.display = 'none';
      // Show the chat panel
      this.chatPanel.classList.remove('hidden');
      this.chatVisible = true;
      // Focus on input
      setTimeout(() => this.chatInput?.focus(), 100);
    }
  }

  hideChat() {
    if (this.chatPanel && document.getElementById('workspaceArea')) {
      // Hide the chat panel
      this.chatPanel.classList.add('hidden');
      // Show the workspace area
      document.getElementById('workspaceArea').style.display = 'flex';
      this.chatVisible = false;
    }
  }

  clearChat() {
    if (this.chatMessages) {
      this.chatHistory = [];
      this.chatMessages.innerHTML = `
        <div class="chat-welcome">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M21 15A2 2 0 0 1 19 17H7L4 20V6A2 2 0 0 1 6 4H19A2 2 0 0 1 21 6V15Z" stroke="currentColor" stroke-width="2"/>
          </svg>
          <h2>AI Assistant</h2>
          <p>Hello! I'm your AI assistant. I can help you with your project, answer questions, review code, debug issues, and much more. What would you like to work on today?</p>
        </div>
      `;
    }
  }

  async sendMessage() {
    const message = this.chatInput?.value.trim();
    if (!message || this.isTyping) return;

    // Clear input and disable send button
    this.chatInput.value = '';
    this.autoResizeTextarea();
    this.isTyping = true;
    this.updateSendButton();

    // Add user message to chat
    this.addMessage('user', message);
    
    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Get project context if available
      let context = null;
      if (this.currentProject) {
        const contextResult = await ipcRenderer.invoke('get-project-context');
        if (contextResult) {
          context = {
            projectPath: contextResult.path,
            files: contextResult.files?.slice(0, 20), // Limit files for context
            structure: contextResult.structure
          };
        }
      }

      // Send message to Gemini
      const response = await ipcRenderer.invoke('gemini-chat', message, context);
      
      this.hideTypingIndicator();
      
      if (response.success) {
        this.addMessage('ai', response.response);
      } else {
        this.addMessage('ai', '❌ Sorry, I encountered an error: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.hideTypingIndicator();
      this.addMessage('ai', '❌ Sorry, I\'m having trouble connecting right now. Please try again.');
    }

    this.isTyping = false;
    this.updateSendButton();
  }

  addMessage(sender, content) {
    if (!this.chatMessages) return;

    // Remove welcome message if it exists
    const welcome = this.chatMessages.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message chat-message-${sender}`;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageEl.innerHTML = `
      <div class="chat-message-bubble">${this.formatChatMessage(content)}</div>
      <div class="chat-message-time">${timeStr}</div>
    `;

    this.chatMessages.appendChild(messageEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // Store in history
    this.chatHistory.push({
      sender,
      content,
      timestamp: now.toISOString()
    });
  }

  formatChatMessage(content) {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/`([^`]+)`/g, '<code style="background: var(--gray-700); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace;">$1</code>') // Inline code
      .replace(/\n/g, '<br>') // Line breaks
      .replace(/```([\s\S]*?)```/g, '<pre style="background: var(--gray-700); padding: 0.5rem; border-radius: 4px; overflow-x: auto; font-family: monospace; margin: 0.5rem 0;">$1</pre>'); // Code blocks
  }

  showTypingIndicator() {
    if (!this.chatMessages) return;

    const typingEl = document.createElement('div');
    typingEl.className = 'chat-message chat-message-ai';
    typingEl.id = 'typing-indicator';
    typingEl.innerHTML = `
      <div class="chat-typing">
        AI is typing
        <div class="chat-typing-dots">
          <div class="chat-typing-dot"></div>
          <div class="chat-typing-dot"></div>
          <div class="chat-typing-dot"></div>
        </div>
      </div>
    `;

    this.chatMessages.appendChild(typingEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  hideTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
      typingEl.remove();
    }
  }

  updateSendButton() {
    if (this.sendChatBtn) {
      this.sendChatBtn.disabled = this.isTyping;
    }
  }

  autoResizeTextarea() {
    if (!this.chatInput) return;
    
    this.chatInput.style.height = 'auto';
    const newHeight = Math.min(this.chatInput.scrollHeight, 120); // Max 120px
    this.chatInput.style.height = newHeight + 'px';
  }

  // Utility Methods
  showLoading(message = 'Loading...') {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('hidden');
      this.loadingOverlay.classList.add('show');
    }
    if (this.loadingText) {
      this.loadingText.textContent = message;
    }
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('show');
      this.loadingOverlay.classList.add('hidden');
    }
  }

  showError(message) {
    // Simple error notification - can be enhanced later
    alert(message);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new StratosphereApp();
});
