import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { IStorage, getStorage } from './db/storage.js';
import { createMenuRouter } from './routes/menu.js';
import { createSettingsRouter } from './routes/settings.js';
import { createOrdersRouter } from './routes/orders.js';
import { createWebhooksRouter } from './routes/webhooks.js';

export function createApp(storageInstance?: IStorage): Express {
  const app = express();
  const storage = storageInstance || getStorage();

  // CORS configuration
  const allowedOrigins = [
    'https://vankalan.hallojanu.me',
    'https://vankalan.hallojanu.xyz',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.hallojanu.me') || origin.endsWith('.hallojanu.xyz')) {
          callback(null, true);
        } else {
          callback(null, true); // Allow all for warung public ordering
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json());

  // Healthcheck endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'vankalan-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount API routers
  const apiRouter = express.Router();
  apiRouter.use('/', createMenuRouter(storage));
  apiRouter.use('/', createSettingsRouter(storage));
  apiRouter.use('/', createOrdersRouter(storage));
  apiRouter.use('/webhooks', createWebhooksRouter(storage));

  app.use('/api', apiRouter);

  // Global 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Unhandled Server Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    });
  });

  return app;
}
