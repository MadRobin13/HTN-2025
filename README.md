# Voice Dev Assistant

A native desktop application that combines voice interaction with AI-powered development capabilities. Built with Electron, featuring a Warp-like interface powered entirely by Google's free Gemini 1.5 Flash model.

## Features

- 🎤 **Voice Interaction**: Speech-to-text and text-to-speech using Web Speech API
- 🤖 **Gemini AI Integration**: 
  - Gemini 1.5 Flash for all AI tasks (free tier)
  - General conversations and project analysis
  - Code generation, review, and debugging
- 📁 **Project Context Awareness**: Automatically understands your project structure
- 🎨 **Modern UI**: Sleek, Warp-inspired interface with dark theme
- 🔄 **Real-time File Watching**: Monitors project changes automatically
- 💬 **Conversation History**: Maintains context across sessions

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- API keys for:
  - Google Gemini API (free tier available)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd voice-dev-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Getting API Keys

### Gemini API Key (Free)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key (free tier available)
3. Copy the key to your `.env` file

**Note**: Gemini 1.5 Flash is available in the free tier with generous quotas.

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Build for Distribution
```bash
npm run build
```

## How to Use

1. **Open a Project**: Click "Open Project" to select your project folder
2. **Voice Interaction**: 
   - Hold the microphone button to speak
   - Release to process your speech
3. **Text Chat**: Type messages in the input field
4. **AI Responses**: 
   - All requests handled by Gemini 1.5 Flash
   - Intelligent routing for different types of tasks
5. **Project Analysis**: The AI automatically understands your project structure

## Voice Commands Examples

- "Explain this project structure"
- "Generate a React component for user authentication"
- "Review the code in main.js"
- "Debug the error in my API call"
- "Refactor this function to be more efficient"
- "Create unit tests for the user service"

## Architecture

```
src/
├── main.js              # Electron main process
├── services/
│   ├── gemini.js        # Gemini AI integration
│   └── claude.js        # Claude AI integration
└── renderer/
    ├── index.html       # Main UI
    ├── styles.css       # Warp-inspired styling
    └── app.js           # Frontend logic & speech APIs
```

## Key Technologies

- **Electron**: Native desktop application framework
- **Gemini 1.5 Flash**: Google's fast, free AI model for all tasks
- **Web Speech API**: Browser-native speech recognition and synthesis
- **Chokidar**: File system watching
- **Marked**: Markdown parsing for AI responses

## Features in Detail

### Voice Recognition
- Uses browser's built-in Web Speech API
- Supports continuous listening
- Real-time transcription
- Automatic message sending on speech end

### AI Integration
- **Unified Model**: Uses Gemini 1.5 Flash for all AI interactions
- **Context Awareness**: Passes project structure and files to AI for better responses
- **Conversation Memory**: Maintains chat history for context
- **Free Tier**: Generous free quotas with Google's Gemini API

### Project Management
- **File Tree**: Visual representation of project structure
- **Real-time Updates**: Automatically refreshes when files change
- **Context Injection**: Provides project context to AI models

## Troubleshooting

### Speech Recognition Not Working
- Ensure you're using a Chromium-based browser engine (built into Electron)
- Check microphone permissions
- Verify HTTPS context (required for Web Speech API)

### API Errors
- Verify your Gemini API key is correct in `.env`
- Check your API quotas (free tier has generous limits)
- Ensure network connectivity

### File Watching Issues
- Check file system permissions
- Verify the project path is accessible
- Some network drives may not support file watching

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Search existing issues
3. Create a new issue with detailed information

---

**Note**: This application requires a free API key from Google Gemini. Make sure to keep your key secure and never commit it to version control.
