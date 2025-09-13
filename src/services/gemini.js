const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.conversationHistory = [];
  }

  async sendMessage(message, context = null) {
    try {
      let prompt = message;
      
      // Add project context if available
      if (context) {
        prompt = `Project Context:
${JSON.stringify(context, null, 2)}

User Message: ${message}

Please provide a helpful response considering the project context. If this is a general conversation, respond naturally. If it involves code analysis or questions about the project, use the context provided.`;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Store in conversation history
      this.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      this.conversationHistory.push({
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        response: text,
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeCode(code, language, question = null) {
    try {
      let prompt = `Analyze this ${language} code:

\`\`\`${language}
${code}
\`\`\``;

      if (question) {
        prompt += `\n\nSpecific question: ${question}`;
      } else {
        prompt += `\n\nPlease provide:
1. A brief summary of what this code does
2. Any potential issues or improvements
3. Code quality assessment
4. Suggestions for optimization`;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        success: true,
        analysis: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Code Analysis Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async explainProject(projectStructure, files) {
    try {
      const prompt = `Analyze this project structure and provide insights:

Project Structure:
${JSON.stringify(projectStructure, null, 2)}

Key Files (first 5):
${files.slice(0, 5).map(f => `- ${f.relativePath} (${f.size} bytes)`).join('\n')}

Please provide:
1. Project type and technology stack
2. Main purpose and functionality
3. Architecture overview
4. Key components and their roles
5. Potential areas for improvement`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        success: true,
        explanation: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Project Analysis Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

module.exports = GeminiService;
