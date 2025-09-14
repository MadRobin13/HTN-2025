import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';

// Extended Request type with auth info
export interface AuthRequest extends Request {
  apiKey?: string;
  userId?: string;
}

// In production, these would be stored in a database
const API_KEYS = new Map<string, { hashedKey: string; userId: string; name: string }>();

// Initialize with a default API key (for demo purposes)
// In production, this should be managed through a proper API key management system
async function initializeDefaultApiKey() {
  const defaultKey = process.env.DEFAULT_API_KEY || 'demo-api-key-change-in-production';
  const hashedKey = await bcrypt.hash(defaultKey, 10);
  API_KEYS.set('demo-user', {
    hashedKey,
    userId: 'demo-user',
    name: 'Demo User',
  });
}

initializeDefaultApiKey().catch(console.error);

export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required',
        },
      });
      return;
    }

    // Validate API key
    let validKey = false;
    let userId: string | undefined;

    for (const [id, keyData] of API_KEYS.entries()) {
      if (await bcrypt.compare(apiKey, keyData.hashedKey)) {
        validKey = true;
        userId = id;
        break;
      }
    }

    if (!validKey) {
      logger.warn('Invalid API key attempt', { 
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      });
      return;
    }

    // Attach user info to request
    req.apiKey = apiKey;
    req.userId = userId;
    
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

export function generateApiKey(): string {
  // Generate a secure random API key
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = 'qwen_';
  
  for (let i = 0; i < 32; i++) {
    apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return apiKey;
}

export async function createApiKey(userId: string, name: string): Promise<string> {
  const apiKey = generateApiKey();
  const hashedKey = await bcrypt.hash(apiKey, 10);
  
  API_KEYS.set(userId, {
    hashedKey,
    userId,
    name,
  });
  
  return apiKey;
}