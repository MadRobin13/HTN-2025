import { v4 as uuidv4 } from 'uuid';
import { AgentRequest, AgentResponse } from '../types.js';
import { AgentExecutor } from './agentExecutor.js';
import { logger } from '../utils/logger.js';

export class JobQueueService {
  private agentExecutor: AgentExecutor;
  private responses: Map<string, AgentResponse>;
  private stats = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
  };

  constructor() {
    this.agentExecutor = new AgentExecutor();
    this.responses = new Map();
  }

  async submitRequest(
    prompt: string,
    context?: AgentRequest['context'],
    metadata?: AgentRequest['metadata'],
    _apiKey?: string
  ): Promise<AgentResponse> {
    const requestId = uuidv4();
    const request: AgentRequest = {
      id: requestId,
      prompt,
      context,
      metadata,
      createdAt: new Date(),
    };

    const response: AgentResponse = {
      id: uuidv4(),
      requestId,
      status: 'processing',
      createdAt: new Date(),
    };

    // Store the response
    this.responses.set(requestId, response);
    this.stats.active++;

    // Execute asynchronously (fire and forget)
    this.executeRequest(request, response).catch(error => {
      logger.error('Failed to execute request', error);
      response.status = 'failed';
      response.error = error.message;
      response.completedAt = new Date();
    });

    // Return immediately with pending status
    response.status = 'pending';
    return response;
  }

  private async executeRequest(request: AgentRequest, response: AgentResponse): Promise<void> {
    try {
      logger.info(`Executing request ${request.id}`);
      response.status = 'processing';
      
      const result = await this.agentExecutor.execute(request);
      
      Object.assign(response, result);
      
      if (result.status === 'completed') {
        this.stats.completed++;
      } else {
        this.stats.failed++;
      }
      this.stats.active--;
      
      logger.info(`Request ${request.id} completed with status: ${result.status}`);
    } catch (error: any) {
      logger.error(`Request ${request.id} failed`, error);
      response.status = 'failed';
      response.error = error.message;
      response.completedAt = new Date();
      this.stats.failed++;
      this.stats.active--;
    }
  }

  async getRequestStatus(requestId: string): Promise<AgentResponse | null> {
    return this.responses.get(requestId) || null;
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    return { ...this.stats };
  }

  async cleanup(): Promise<void> {
    // Clean up old responses (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [requestId, response] of this.responses.entries()) {
      if (response.createdAt < oneHourAgo && 
          (response.status === 'completed' || response.status === 'failed')) {
        this.responses.delete(requestId);
      }
    }
  }

  async close(): Promise<void> {
    // No-op for simple implementation
  }
}