// Example: How to use the streaming API from the frontend
// This would go in your renderer process (frontend) code

class QwenStreamingClient {
  constructor() {
    this.isStreaming = false;
  }

  async startStream(prompt, onChunk, onComplete, onError) {
    if (this.isStreaming) {
      console.warn('Already streaming, ignoring new request');
      return;
    }

    this.isStreaming = true;

    try {
      // Set up event listeners for streaming events
      const removeListeners = this.setupStreamListeners(onChunk, onComplete, onError);

      // Start the streaming request
      const result = await window.electronAPI.streamQwenRequest(prompt, {
        // Add any additional context here
      });

      if (!result.success) {
        onError(result.error);
        removeListeners();
        this.isStreaming = false;
      }

    } catch (error) {
      console.error('Failed to start streaming:', error);
      onError(error.message);
      this.isStreaming = false;
    }
  }

  setupStreamListeners(onChunk, onComplete, onError) {
    // Listen for streaming chunks
    const chunkListener = (event, data) => {
      switch (data.type) {
        case 'status':
          console.log('Status:', data.status, data.message);
          break;
        case 'chunk':
          onChunk(data.content);
          break;
        case 'error':
          onError(data.error);
          break;
      }
    };

    // Listen for completion
    const completeListener = () => {
      this.isStreaming = false;
      onComplete();
      removeListeners();
    };

    // Listen for errors
    const errorListener = (event, data) => {
      this.isStreaming = false;
      onError(data.error);
      removeListeners();
    };

    // Add event listeners
    window.electronAPI.onQwenStreamChunk(chunkListener);
    window.electronAPI.onQwenStreamComplete(completeListener);
    window.electronAPI.onQwenStreamError(errorListener);

    // Return function to remove listeners
    const removeListeners = () => {
      window.electronAPI.removeQwenStreamChunk(chunkListener);
      window.electronAPI.removeQwenStreamComplete(completeListener);
      window.electronAPI.removeQwenStreamError(errorListener);
    };

    return removeListeners;
  }
}

// Usage example:
const streamingClient = new QwenStreamingClient();

function startStreamingChat() {
  const prompt = "Write a Python function to calculate fibonacci numbers";
  const outputElement = document.getElementById('streaming-output');
  
  outputElement.innerHTML = ''; // Clear previous content
  
  streamingClient.startStream(
    prompt,
    // On chunk received
    (chunk) => {
      outputElement.innerHTML += chunk;
      outputElement.scrollTop = outputElement.scrollHeight; // Auto-scroll
    },
    // On complete
    () => {
      console.log('Streaming completed!');
      outputElement.innerHTML += '\n\n✅ Response completed';
    },
    // On error
    (error) => {
      console.error('Streaming error:', error);
      outputElement.innerHTML += `\n\n❌ Error: ${error}`;
    }
  );
}

// You would also need to add these methods to your electronAPI preload:
/*
In your preload.js, add:

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  
  // Streaming methods
  streamQwenRequest: (prompt, context) => ipcRenderer.invoke('qwen-stream-request', prompt, context),
  
  // Event listeners for streaming
  onQwenStreamChunk: (callback) => ipcRenderer.on('qwen-stream-chunk', callback),
  onQwenStreamComplete: (callback) => ipcRenderer.on('qwen-stream-complete', callback),
  onQwenStreamError: (callback) => ipcRenderer.on('qwen-stream-error', callback),
  
  // Remove event listeners
  removeQwenStreamChunk: (callback) => ipcRenderer.removeListener('qwen-stream-chunk', callback),
  removeQwenStreamComplete: (callback) => ipcRenderer.removeListener('qwen-stream-complete', callback),
  removeQwenStreamError: (callback) => ipcRenderer.removeListener('qwen-stream-error', callback)
});
*/