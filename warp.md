# Warp Integration Guide

This document outlines how to use the Voice Dev Assistant with Warp terminal for an enhanced development experience.

## About Voice Dev Assistant

Voice Dev Assistant is a native desktop application that combines voice interaction with AI-powered development capabilities. Built with Electron and featuring a Warp-like interface, it's powered entirely by Google's free Gemini 1.5 Flash model.

## Warp Terminal Integration

### Quick Setup in Warp

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd voice-dev-assistant
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your Gemini API key
   ```

3. **Launch Development Mode**
   ```bash
   npm run dev
   ```

### Warp Workflows

#### Development Workflow
```bash
# Start the application in development mode
npm run dev

# In another Warp tab, monitor logs
tail -f ~/.voice-dev-assistant/logs/app.log

# Run tests
npm test

# Build for production
npm run build
```

#### Project Analysis Workflow
```bash
# Open project in Voice Dev Assistant
# Use voice commands like:
# "Analyze this project structure"
# "Review the main.js file"
# "Generate tests for the Gemini service"
```

## Voice Commands for Developers

### Code Analysis
- "Explain this project structure"
- "Review the code in [filename]"
- "What does this function do?"
- "Find potential bugs in this file"

### Code Generation
- "Generate a React component for user authentication"
- "Create a REST API endpoint for user management"
- "Write unit tests for the Gemini service"
- "Generate TypeScript interfaces for this data"

### Debugging
- "Debug the error in my API call"
- "Why is this function not working?"
- "Help me fix this async/await issue"
- "Analyze this stack trace"

### Refactoring
- "Refactor this function to be more efficient"
- "Convert this to use modern JavaScript syntax"
- "Extract this logic into a separate module"
- "Optimize this database query"

## Warp Features Integration

### AI Command Suggestions
Use Warp's AI features alongside Voice Dev Assistant:
- Type `#` in Warp to get AI command suggestions
- Use Voice Dev Assistant for code-specific queries
- Combine both for comprehensive development assistance

### Workflow Automation
Create Warp workflows for common Voice Dev Assistant tasks:

```yaml
# .warp/workflows/voice-dev.yaml
name: Voice Dev Assistant
command: |
  echo "🎤 Starting Voice Dev Assistant..."
  npm run dev
  echo "✅ Voice Dev Assistant is running!"
```

### Terminal Integration
Voice Dev Assistant complements Warp by:
- Providing voice-controlled code generation
- Offering AI-powered project analysis
- Enabling hands-free development queries
- Maintaining conversation context across sessions

## Best Practices

### Using Both Tools Together
1. **Warp for Commands**: Use Warp for git operations, file management, and running scripts
2. **Voice Assistant for Code**: Use Voice Dev Assistant for code analysis, generation, and debugging
3. **Context Switching**: Keep both open for seamless workflow transitions

### Voice Command Tips
- Speak clearly and pause briefly before releasing the microphone
- Use specific file names and function names for better context
- Break complex requests into smaller, focused questions
- Leverage the conversation history for follow-up questions

### Performance Optimization
- Keep project files organized for better AI analysis
- Use `.gitignore` to exclude unnecessary files from context
- Regular cleanup of conversation history for better performance

## Troubleshooting

### Common Issues

#### Voice Recognition
- Ensure microphone permissions are granted
- Check that you're in an HTTPS context (Electron provides this)
- Verify Web Speech API support (built into Chromium/Electron)

#### Warp Terminal Issues
- Make sure Node.js and npm are in PATH
- Verify project dependencies are installed
- Check that ports aren't already in use

#### Integration Problems
- Ensure both applications have necessary permissions
- Check network connectivity for AI API calls
- Verify API keys are properly configured

### Debug Commands
```bash
# Check Node.js version
node --version

# Verify npm installation
npm --version

# Test Gemini API connection
npm run test:api

# Check application logs
tail -f ~/.voice-dev-assistant/logs/app.log
```

## Advanced Usage

### Custom Voice Commands
Extend the application with custom voice commands for your specific workflow:

```javascript
// Example: Add custom project-specific commands
const customCommands = {
  "deploy to staging": () => {
    exec("npm run deploy:staging");
  },
  "run all tests": () => {
    exec("npm run test:full");
  }
};
```

### API Integration
Leverage the Gemini API for custom development tasks:

```javascript
// Example: Custom code analysis
const analyzeCode = async (filePath) => {
  const response = await geminiService.analyze({
    task: "code-review",
    file: filePath,
    context: projectContext
  });
  return response;
};
```

## Contributing

To contribute to Warp integration features:

1. Fork the repository
2. Create a feature branch for Warp-specific improvements
3. Test with various Warp versions and configurations
4. Submit a pull request with detailed integration notes

## Support

For Warp-specific issues:
1. Check Warp terminal version compatibility
2. Verify Node.js and npm versions in Warp
3. Test voice functionality in different Warp themes
4. Report integration-specific bugs with environment details

---

**Note**: This application works best when used alongside Warp terminal, combining the power of AI-assisted development with Warp's modern terminal features.
