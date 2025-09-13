const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

class StratosphereApp {
  constructor() {
    this.currentProject = null;
    this.recentProjects = this.loadRecentProjects();
    this.currentScreen = 'welcome'; // 'welcome', 'project'
    
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
          console.log('File clicked:', filePath);
          // TODO: Implement file opening in editor
        }
      });
    });
  }

  buildFileTreeHtml(structure, basePath = '') {
    let html = '';
    
    for (const [name, content] of Object.entries(structure || {})) {
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

  async refreshFileTree() {
    if (this.currentProject) {
      await this.loadProjectFiles(this.currentProject.path);
    }
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
