# Qwen API Integration Guide

This project now includes the Qwen API server integrated directly into the HTN-2025 repository.

## 📁 Project Structure

```
HTN-2025/
├── src/                    # Electron desktop app source
│   ├── main.js            # Main process (updated to use qwen-api)
│   └── services/
│       └── apiServer.js   # Integrated API server (alternative)
├── qwen-api/              # Qwen API server (copied from separate repo)
│   ├── src/               # TypeScript source files
│   ├── dist/              # Compiled JavaScript
│   ├── .env               # Environment configuration
│   └── package.json       # Dependencies for qwen-api
├── package.json           # Main project dependencies
├── start-dev.bat          # Windows batch startup script
└── start-dev.ps1          # PowerShell startup script
```

## 🚀 Quick Start

### Option 1: Using PowerShell (Recommended)
```powershell
.\start-dev.ps1
```

### Option 2: Using Command Prompt
```batch
start-dev.bat
```

### Option 3: Manual Start
```bash
# Terminal 1: Start Qwen API Server
cd qwen-api
npm install
npm run dev

# Terminal 2: Start Desktop App
npm install
npm run dev
```

## ⚙️ Configuration

### Qwen API Configuration
Edit `qwen-api/.env` to configure:
- `PORT`: API server port (default: 3001)
- `QWEN_CLI_PATH`: Path to the qwen CLI executable
- `API_KEY_SECRET`: API key for authentication

### Desktop App Configuration
The desktop app is configured to:
- Use the qwen-api server on port 3001
- Pass the current project directory as `workingDirectory`
- Include project context in API requests

## 🔧 Key Changes Made

1. **Qwen API Server Integration**
   - Copied qwen-api server into HTN-2025/qwen-api
   - Updated to run on port 3001 to avoid conflicts
   - Configured for local development

2. **Desktop App Updates**
   - Updated API URLs to use port 3001
   - Modified to pass `workingDirectory` parameter
   - Updated API key for local development

3. **Convenience Scripts**
   - Added npm scripts for qwen-api management
   - Created startup scripts for Windows

## 📝 API Usage

The desktop app communicates with the qwen-api server:

1. **Submit Request**: `POST http://localhost:3001/api/agent/requests`
   - Sends prompt with current project directory as working directory
   
2. **Check Status**: `GET http://localhost:3001/api/agent/requests/:id`
   - Polls for request completion

3. **Health Check**: `GET http://localhost:3001/api/agent/health`
   - Verifies API server is running

## 🔍 Troubleshooting

### Port Conflicts
If port 3001 is in use, edit `qwen-api/.env` and change the PORT value.

### Qwen CLI Not Found
Update `QWEN_CLI_PATH` in `qwen-api/.env` to point to your qwen CLI location.

### Dependencies Issues
Run `npm run install-all` to install dependencies for both projects.

## 🔐 Security Notes

For production deployment:
1. Change API keys in `qwen-api/.env`
2. Configure proper CORS origins
3. Use HTTPS
4. Implement proper authentication

## 📚 Additional Resources

- [Qwen API Documentation](qwen-api/README.md)
- [Desktop App Documentation](README.md)

---

**Note**: The integrated API server in `src/services/apiServer.js` is kept as a fallback option but the external qwen-api server on port 3001 is now the primary method.