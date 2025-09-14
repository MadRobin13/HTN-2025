import { z } from 'zod';

export const agentRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  context: z.object({
    workingDirectory: z.string().optional(),
    environment: z.record(z.string()).optional(),
    timeout: z.number().min(1000).max(600000).optional(), // 1 second to 10 minutes
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const apiKeySchema = z.string().min(32).max(128);

export type ValidatedAgentRequest = z.infer<typeof agentRequestSchema>;