const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class IntegratedApiServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = process.env.API_SERVER_PORT || 3000;
    this.requests = new Map(); // Store request status
    this.requestCounter = 0;
    this.sessions = new Map(); // Store conversation sessions
    this.activeQwenProcess = null; // Keep track of active Qwen process
    this.sessionId = 'default'; // Use a single session for simplicity
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/api/agent/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Qwen Agent API',
        timestamp: new Date().toISOString()
      });
    });

    // Submit request endpoint
    this.app.post('/api/agent/requests', async (req, res) => {
      try {
        const { prompt, context } = req.body;
        
        if (!prompt) {
          return res.status(400).json({
            error: { message: 'Prompt is required' }
          });
        }

        const requestId = `req_${Date.now()}_${++this.requestCounter}`;
        
        // Initialize request status
        this.requests.set(requestId, {
          id: requestId,
          status: 'pending',
          prompt,
          context,
          createdAt: new Date(),
          output: null,
          error: null
        });

        // Process the request asynchronously
        // this.processQwenRequest(requestId, prompt, context); // Disabled for streaming

        res.json({
          data: {
            requestId,
            status: 'pending'
          }
        });
      } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({
          error: { message: error.message }
        });
      }
    });

    // Get request status endpoint
    this.app.get('/api/agent/requests/:id', (req, res) => {
      const requestId = req.params.id;
      const request = this.requests.get(requestId);

      if (!request) {
        return res.status(404).json({
          error: { message: 'Request not found' }
        });
      }

      res.json({
        data: {
          requestId: request.id,
          status: request.status,
          output: request.output,
          error: request.error,
          createdAt: request.createdAt
        }
      });
    });

    // Streaming endpoint
    this.app.post('/api/agent/stream', async (req, res) => {
      try {
        const { prompt, context } = req.body;
        
        if (!prompt) {
          return res.status(400).json({
            error: { message: 'Prompt is required' }
          });
        }

        // Set up Server-Sent Events
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key',
        });

        // Start streaming response
        await this.streamQwenResponse(prompt, context, res);
        
      } catch (error) {
        console.error('Error in streaming request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: { message: error.message }
          });
        }
      }
    });
  }

  async processQwenRequest(requestId, prompt, context) {
    try {
      console.log(`Processing Qwen request ${requestId}:`, prompt.substring(0, 100) + '...');
      
      // Update status to processing
      const request = this.requests.get(requestId);
      request.status = 'processing';

      // Execute Qwen CLI
      const result = await this.executeQwenCli(prompt, context);
      
      // Update request with result
      request.status = 'completed';
      request.output = result;
      
      console.log(`Qwen request ${requestId} completed successfully`);
    } catch (error) {
      console.error(`Qwen request ${requestId} failed:`, error);
      const request = this.requests.get(requestId);
      request.status = 'failed';
      request.error = error.message;
    }
  }

  async streamQwenResponse(prompt, context, res) {
    try {
      console.log(`Starting streaming response for prompt:`, prompt.substring(0, 100) + '...');
      
      // Send initial status
      res.write(`data: ${JSON.stringify({type: 'status', status: 'processing', message: 'Starting AI response...'})}\n\n`);
      
      // Resolve the qwen CLI path
      let qwenCliPath = process.env.QWEN_CLI_PATH || path.join(__dirname, '../../qwen-cli-bundle/gemini.js');
      
      if (process.env.QWEN_CLI_PATH && !path.isAbsolute(process.env.QWEN_CLI_PATH)) {
        qwenCliPath = path.resolve(path.join(__dirname, '../..'), process.env.QWEN_CLI_PATH);
      }
      
      await this.executeQwenWithStreaming(prompt, context, qwenCliPath, res);
      
    } catch (error) {
      console.error('Streaming error:', error);
      res.write(`data: ${JSON.stringify({type: 'error', error: error.message})}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  async executeQwenWithStreaming(prompt, context, qwenCliPath, res) {
    return new Promise((resolve, reject) => {
      // Get or initialize conversation history
      if (!this.sessions.has(this.sessionId)) {
        this.sessions.set(this.sessionId, {
          history: [],
          context: context
        });
      }
      
      const session = this.sessions.get(this.sessionId);
      session.history.push({ role: 'user', content: prompt });
      
      // Build full conversation context
      let fullPrompt = '';
      if (session.history.length > 1) {
        fullPrompt = 'Previous conversation:\n';
        for (const msg of session.history.slice(-6)) {
          if (msg.role === 'user') {
            fullPrompt += `User: ${msg.content}\n`;
          } else {
            fullPrompt += `Assistant: ${msg.content}\n`;
          }
        }
        fullPrompt += `\nCurrent request: ${prompt}`;
      } else {
        fullPrompt = prompt;
      }
      
      console.log('Executing Qwen CLI with streaming:', fullPrompt.substring(0, 100) + '...');
      
      // Prepare command arguments
      let args = ['--prompt', fullPrompt];
      
      const projectDir = context?.workingDirectory || context?.projectPath;
      if (projectDir) {
        args.push('--include-directories', projectDir);
      }
      
      args.push('--yolo');
      
      const workingDir = context?.workingDirectory || context?.projectPath || process.cwd();
      console.log('Setting Qwen CLI working directory to:', workingDir);
      console.log('Context received:', JSON.stringify(context, null, 2));
      
      // Spawn the Qwen CLI process
      const qwenProcess = spawn('node', [qwenCliPath, ...args], {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let fullOutput = '';
      let lastChunkTime = Date.now();
      
      // Stream stdout in real-time
      qwenProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        fullOutput += chunk;
        
        // Send chunk to client
        res.write(`data: ${JSON.stringify({type: 'chunk', content: chunk})}\n\n`);
        lastChunkTime = Date.now();
      });
      
      // Handle stderr
      qwenProcess.stderr.on('data', (data) => {
        const errorChunk = data.toString();
        console.error('Qwen CLI stderr:', errorChunk);
        
        // Only send actual errors, not warnings
        if (!errorChunk.includes('Warning:') && !errorChunk.includes('DeprecationWarning') && !errorChunk.includes('Failed to load tiktoken')) {
          res.write(`data: ${JSON.stringify({type: 'error', error: errorChunk})}\n\n`);
        }
      });
      
      // Handle process completion
      qwenProcess.on('close', (code) => {
        if (code === 0) {
          const cleanedOutput = this.cleanQwenResponse(fullOutput);
          session.history.push({ role: 'assistant', content: cleanedOutput });
          
          res.write(`data: ${JSON.stringify({type: 'status', status: 'completed', message: 'Response completed successfully'})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          resolve();
        } else {
          const error = `Qwen CLI exited with code ${code}`;
          res.write(`data: ${JSON.stringify({type: 'error', error: error})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          reject(new Error(error));
        }
      });
      
      // Handle process errors
      qwenProcess.on('error', (error) => {
        console.error('Qwen process error:', error);
        res.write(`data: ${JSON.stringify({type: 'error', error: `Failed to start Qwen CLI: ${error.message}`})}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        reject(error);
      });
      
      // No timeout - let the agent take as long as it needs
    });
  }

  async executeQwenCli(prompt, context) {
    return new Promise((resolve, reject) => {
      // Resolve the qwen CLI path to an absolute path
      let qwenCliPath = process.env.QWEN_CLI_PATH || path.join(__dirname, '../../qwen-cli-bundle/gemini.js');
      
      // If the path from env is relative, resolve it from the app root
      if (process.env.QWEN_CLI_PATH && !path.isAbsolute(process.env.QWEN_CLI_PATH)) {
        qwenCliPath = path.resolve(path.join(__dirname, '../..'), process.env.QWEN_CLI_PATH);
      }
      
      console.log('Using Qwen CLI path:', qwenCliPath);
      console.log('Path exists:', fs.existsSync(qwenCliPath));
      
      // For now, let's use a simpler approach with conversation history
      this.executeQwenWithHistory(prompt, context, resolve, reject, qwenCliPath);
    });
  }

  async executeQwenWithHistory(prompt, context, resolve, reject, qwenCliPath) {
    // Get or initialize conversation history for this session
    if (!this.sessions.has(this.sessionId)) {
      this.sessions.set(this.sessionId, {
        history: [],
        context: context
      });
    }
    
    const session = this.sessions.get(this.sessionId);
    session.history.push({ role: 'user', content: prompt });
    
    // Build full conversation context
    let fullPrompt = '';
    if (session.history.length > 1) {
      fullPrompt = 'Previous conversation:\n';
      for (const msg of session.history.slice(-6)) { // Keep last 6 messages for context
        if (msg.role === 'user') {
          fullPrompt += `User: ${msg.content}\n`;
        } else {
          fullPrompt += `Assistant: ${msg.content}\n`;
        }
      }
      fullPrompt += `\nCurrent request: ${prompt}`;
    } else {
      fullPrompt = prompt;
    }
    
    console.log('Executing Qwen CLI with history context:', fullPrompt.substring(0, 100) + '...');
    
    // Prepare the command arguments
    let args = ['--prompt', fullPrompt];
    
    // Add context if provided - use workingDirectory or fall back to projectPath
    const projectDir = context?.workingDirectory || context?.projectPath;
    if (projectDir) {
      args.push('--include-directories', projectDir);
    }
    
    // Enable auto-approval for non-interactive use
    args.push('--yolo');
    
    // Determine working directory - prioritize workingDirectory, then projectPath, otherwise current directory
    const workingDir = context?.workingDirectory || context?.projectPath || process.cwd();
    console.log('Setting Qwen CLI working directory to:', workingDir);
    
    // Spawn the Qwen CLI process
    const qwenProcess = spawn('node', [qwenCliPath, ...args], {
      cwd: workingDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    
    qwenProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    qwenProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    qwenProcess.on('close', (code) => {
      if (code === 0) {
        const output = stdout.trim() || 'Request completed successfully.';
        // Add assistant response to history
        session.history.push({ role: 'assistant', content: output });
        resolve(output);
      } else {
        const error = stderr.trim() || `Qwen CLI exited with code ${code}`;
        reject(new Error(error));
      }
    });
    
    qwenProcess.on('error', (error) => {
      reject(new Error(`Failed to start Qwen CLI: ${error.message}`));
    });
    
    // No timeout - let the agent work as long as needed
  }

  cleanQwenResponse(rawOutput) {
    // Remove ANSI escape codes and control characters
    let cleaned = rawOutput.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Remove prompts and command echoes
    cleaned = cleaned.replace(/^.*> /gm, '');
    cleaned = cleaned.replace(/^.*\$ /gm, '');
    
    // Remove the original prompt if it's echoed back
    const lines = cleaned.split('\n');
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('Type /help') && 
             !trimmed.includes('Qwen Code') &&
             !trimmed.includes('>');
    });
    
    return meaningfulLines.join('\n').trim() || 'Response received but content was empty.';
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, 'localhost', () => {
        console.log(`🟢 API Server running on http://localhost:${this.port}`);
        console.log(`🔍 Health check: http://localhost:${this.port}/api/agent/health`);
        resolve();
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`⚠️  Port ${this.port} is busy, trying next port...`);
          this.port++;
          this.start().then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });
    });
  }

  async stop() {
    // Close active Qwen session first
    if (this.activeQwenProcess && !this.activeQwenProcess.killed) {
      console.log('Closing active Qwen session...');
      this.activeQwenProcess.stdin.write('/quit\n');
      
      // Give it a moment to close gracefully, then force kill if needed
      setTimeout(() => {
        if (this.activeQwenProcess && !this.activeQwenProcess.killed) {
          this.activeQwenProcess.kill();
        }
      }, 2000);
    }
    
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('API Server stopped');
          resolve();
        });
      });
    }
  }

  getPort() {
    return this.port;
  }
}

module.exports = IntegratedApiServer;