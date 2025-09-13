const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiCodeService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateCode(prompt, language = 'javascript', context = null) {
    try {
      let fullPrompt = `You are an expert software developer. Generate clean, efficient, and well-documented ${language} code based on the user's requirements.

User Request: ${prompt}`;
      
      if (context) {
        fullPrompt = `You are an expert software developer. Generate clean, efficient, and well-documented ${language} code based on the user's requirements.

Project Context:
${JSON.stringify(context, null, 2)}

Code Request: ${prompt}

Please generate code that fits well within this project structure and follows the existing patterns.`;
      }

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;

      return {
        success: true,
        code: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Gemini Code Generation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async reviewCode(code, language, reviewType = 'general') {
    try {
      const prompt = `You are a senior code reviewer. Provide detailed, constructive feedback on the provided ${language} code.

Please review this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Review Type: ${reviewType}

Please provide:
1. Code quality assessment
2. Potential bugs or issues
3. Performance considerations
4. Security concerns (if applicable)
5. Suggestions for improvement
6. Best practices recommendations`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return {
        success: true,
        review: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Code Review Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async refactorCode(code, language, instructions) {
    try {
      const prompt = `You are an expert software developer specializing in code refactoring. Improve the provided code while maintaining its functionality.

Please refactor this ${language} code according to the instructions:

Original Code:
\`\`\`${language}
${code}
\`\`\`

Refactoring Instructions: ${instructions}

Please provide:
1. The refactored code
2. Explanation of changes made
3. Benefits of the refactoring`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return {
        success: true,
        refactoredCode: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Code Refactoring Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugCode(code, language, errorMessage = null, description = null) {
    try {
      let prompt = `You are an expert debugger. Help identify and fix issues in the provided code.

Please help debug this ${language} code:

\`\`\`${language}
${code}
\`\`\``;

      if (errorMessage) {
        prompt += `\n\nError Message: ${errorMessage}`;
      }

      if (description) {
        prompt += `\n\nProblem Description: ${description}`;
      }

      prompt += `\n\nPlease provide:
1. Identified issues
2. Root cause analysis
3. Fixed code
4. Prevention strategies`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return {
        success: true,
        debugInfo: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Code Debugging Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async explainCode(code, language) {
    try {
      const prompt = `You are a programming instructor. Explain code clearly and comprehensively.

Please explain this ${language} code in detail:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Overall purpose and functionality
2. Step-by-step breakdown
3. Key concepts and patterns used
4. Dependencies and requirements
5. Usage examples (if applicable)`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;

      return {
        success: true,
        explanation: response.text(),
        model: 'gemini-1.5-flash'
      };
    } catch (error) {
      console.error('Code Explanation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GeminiCodeService;
