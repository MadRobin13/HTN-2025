# Stratosphere - Project Management App

Stratosphere is an Electron-based project management application that helps you create, organize, and manage your development projects with a space-themed interface.

## Features

### 🚀 Welcome Screen
- Clean, space-themed welcome interface
- Three main action cards for easy navigation
- Recent projects display with quick access

### 📁 Project Creation
- Create new projects with various templates:
  - Blank Project
  - Web Application (HTML/CSS/JS)
  - Node.js Project
  - Python Project
- Choose project location via directory browser
- Rocket launch animation during project creation

### 📦 Project Management
- Open existing projects from file system
- Recent projects tracking with persistent storage
- Project view with file tree navigation
- Git repository status indication

### 🔗 GitHub Integration
- Clone repositories directly from GitHub
- Simple URL-based cloning interface
- Automatic project setup after cloning

### 🎨 User Interface
- Modern, space-themed design
- Responsive layout
- Smooth transitions and animations
- Loading states and user feedback

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd HTN-2025
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

## Project Structure

```
HTN-2025/
├── src/
│   ├── main.js              # Electron main process
│   ├── renderer/
│   │   ├── index.html       # App UI structure
│   │   ├── styles.css       # All styling and animations
│   │   └── app.js           # Renderer process logic
│   └── services/            # AI services (Gemini/Claude)
├── package.json             # App metadata and dependencies
└── README.md               # This file
```

## Technical Details

### Architecture
- **Main Process**: Handles IPC, file operations, project management
- **Renderer Process**: Manages UI, user interactions, navigation
- **Data Storage**: Recent projects stored in `~/.stratosphere/recent-projects.json`

### Key Technologies
- Electron for desktop app framework
- Node.js for backend operations
- HTML/CSS/JavaScript for frontend
- Git for repository cloning

### Project Templates
Each template creates appropriate starter files:
- **Web**: HTML, CSS, JS files with basic structure
- **Node.js**: package.json, main script, README
- **Python**: main.py, requirements.txt, README
- **Blank**: Just README and .gitignore

## Usage

1. **Creating Projects**: Click "New Project" → Fill details → Watch rocket animation → Start coding
2. **Opening Projects**: Click "Open Project" → Browse to folder → File tree loads
3. **GitHub Cloning**: Click "Clone from GitHub" → Enter repo URL → Choose location → Project opens
4. **Recent Projects**: Click any recent project from the welcome screen to reopen

## Development

The app is fully functional with:
- ✅ Project creation and management
- ✅ GitHub repository cloning
- ✅ File tree navigation
- ✅ Recent projects tracking
- ✅ Welcome/project screen navigation
- ✅ Rocket launch animations
- ✅ Modern UI with space theme

## Future Enhancements

Potential improvements could include:
- Code editor integration
- Terminal integration
- Advanced GitHub features (authentication, branch management)
- Project templates marketplace
- AI-powered code assistance
- Collaborative features

---

**Built with Electron** 🚀 **Launch your projects into orbit!**