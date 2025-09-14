import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import agentRoutes from './routes/agent.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });
  
  next();
});

// Routes
app.use('/api/agent', agentRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Qwen Code API Server',
    version: '0.0.1',
    documentation: '/api/docs',
    health: '/api/agent/health',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Cleanup interval for old responses
setInterval(() => {
  // This would be handled by the jobQueue service
  logger.debug('Running cleanup task');
}, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  console.log(`
╔════════════════════════════════════════╗
║       Qwen Code API Server             ║
║                                        ║
║  Version: 0.0.1                        ║
║  Port: ${PORT}                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}         ║
║                                        ║
║  Endpoints:                            ║
║  POST   /api/agent/requests           ║
║  GET    /api/agent/requests/:id       ║
║  GET    /api/agent/stats              ║
║  GET    /api/agent/health             ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});