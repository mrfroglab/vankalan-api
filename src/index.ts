import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { notificationWorker } from './worker/notificationQueue.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

// Start background notification retry worker
notificationWorker.start(10000); // Check every 10 seconds

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 [vankalan-api] Server running on http://${HOST}:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 WAHA URL: ${process.env.WAHA_BASE_URL || '(simulated)'}`);
  console.log(`💳 Midtrans: ${process.env.MIDTRANS_SERVER_KEY ? 'Configured' : '(simulation fallback)'}`);
});

function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  notificationWorker.stop();
  server.close(() => {
    console.log('✅ HTTP server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forcing process shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
