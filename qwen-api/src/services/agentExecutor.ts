import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgentRequest, AgentResponse } from '../types.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentExecutor {
  private qwenCliPath: string;
  private defaultTimeout: number;

  constructor() {
    this.qwenCliPath = process.env.QWEN_CLI_PATH || 
      path.resolve(__dirname, '../../../bundle/gemini.js');
    this.defaultTimeout = parseInt(process.env.QWEN_TIMEOUT_MS || '300000', 10);
  }

  async execute(request: AgentRequest): Promise<Partial<AgentResponse>> {
    const startTime = Date.now();
    const timeout = request.context?.timeout || this.defaultTimeout;
    
    return new Promise((resolve) => {
      let output = '';
      let error = '';
      let processKilled = false;

      logger.info(`Executing agent request ${request.id}`, {
        prompt: request.prompt.substring(0, 100),
        workingDirectory: request.context?.workingDirectory,
      });

      // Prepare the command with YOLO mode for auto-approval
      const args: string[] = ['--yolo'];
      const env = {
        ...process.env,
        ...request.context?.environment,
      };

      // Spawn the Qwen CLI process
      const qwenProcess = spawn('node', [this.qwenCliPath, ...args], {
        cwd: request.context?.workingDirectory || process.cwd(),
        env,
        shell: true,
      });

      // Send the prompt to stdin
      qwenProcess.stdin.write(request.prompt);
      qwenProcess.stdin.end();

      // Capture stdout
      qwenProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Capture stderr
      qwenProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        processKilled = true;
        qwenProcess.kill('SIGTERM');
        logger.warn(`Agent request ${request.id} timed out after ${timeout}ms`);
      }, timeout);

      // Handle process completion
      qwenProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const executionTime = Date.now() - startTime;

        if (processKilled) {
          resolve({
            status: 'failed',
            error: `Process timed out after ${timeout}ms`,
            executionTime,
            completedAt: new Date(),
          });
        } else if (code !== 0) {
          logger.error(`Agent request ${request.id} failed with code ${code}`, { error });
          resolve({
            status: 'failed',
            error: error || `Process exited with code ${code}`,
            output: output || undefined,
            executionTime,
            completedAt: new Date(),
          });
        } else {
          logger.info(`Agent request ${request.id} completed successfully`, {
            executionTime,
          });
          resolve({
            status: 'completed',
            output,
            executionTime,
            completedAt: new Date(),
          });
        }
      });

      // Handle process errors
      qwenProcess.on('error', (err) => {
        clearTimeout(timeoutHandle);
        logger.error(`Agent request ${request.id} process error`, err);
        resolve({
          status: 'failed',
          error: err.message,
          executionTime: Date.now() - startTime,
          completedAt: new Date(),
        });
      });
    });
  }
}