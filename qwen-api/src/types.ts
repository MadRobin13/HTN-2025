export interface AgentRequest {
  id: string;
  prompt: string;
  context?: {
    workingDirectory?: string;
    environment?: Record<string, string>;
    timeout?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentResponse {
  id: string;
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output?: string;
  error?: string;
  executionTime?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface JobData {
  request: AgentRequest;
  apiKey: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthToken {
  apiKey: string;
  issuedAt: number;
  expiresAt: number;
}