import { Router } from 'express';
import { agentRequestSchema } from '../validation.js';
import { JobQueueService } from '../services/simpleJobQueue.js';
import { authenticateApiKey, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();
const jobQueue = new JobQueueService();

// Submit a new agent request
router.post('/requests', authenticateApiKey, async (req: AuthRequest, res): Promise<void> => {
  try {
    // Validate request body
    const validation = agentRequestSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.errors,
        },
      });
      return;
    }

    const { prompt, context, metadata } = validation.data;
    
    // Submit request to queue
    const response = await jobQueue.submitRequest(
      prompt,
      context,
      metadata,
      req.apiKey
    );

    logger.info('Agent request submitted', {
      requestId: response.requestId,
      userId: req.userId,
    });

    res.status(202).json({
      data: response,
      message: 'Request accepted and queued for processing',
    });
  } catch (error) {
    logger.error('Error submitting agent request', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit request',
      },
    });
  }
});

// Get request status
router.get('/requests/:requestId', authenticateApiKey, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { requestId } = req.params;
    
    const response = await jobQueue.getRequestStatus(requestId);
    
    if (!response) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Request not found',
        },
      });
      return;
    }

    res.json({
      data: response,
    });
  } catch (error) {
    logger.error('Error getting request status', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get request status',
      },
    });
  }
});

// Get queue statistics
router.get('/stats', authenticateApiKey, async (_req: AuthRequest, res) => {
  try {
    const stats = await jobQueue.getQueueStats();
    
    res.json({
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting queue stats', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get queue statistics',
      },
    });
  }
});

// Health check endpoint (no auth required)
router.get('/health', async (_req, res) => {
  try {
    const stats = await jobQueue.getQueueStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: stats,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Queue service unavailable',
    });
  }
});

export default router;