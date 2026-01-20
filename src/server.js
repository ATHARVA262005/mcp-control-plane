import app from './app.js';
import { config } from './config/index.js';
import { connectDB } from './infrastructure/db.js';
import agenda from './infrastructure/scheduler.js';
import logger from './infrastructure/logger.js';
import { registerJobs } from './jobs/index.js';

const startServer = async () => {
  await connectDB();
  registerJobs();
  
  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');
    await agenda.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start Agenda after definitions are loaded
  await agenda.start();

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
  });
};

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
