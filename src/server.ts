import app from './app';
import config from './config/env';
import logger from './utils/logger';
import prisma from './prisma/client';

const PORT = config.port;

async function connectWithRetry(maxAttempts = 5, delay = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`; // Test query
      logger.info('✓ Database connected successfully');
      return true;
    } catch (error: any) {
      logger.warn(`Database connection attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      
      if (attempt === maxAttempts) {
        throw new Error(`Failed to connect to database after ${maxAttempts} attempts`);
      }
      
      // Wait before retrying (Neon cold start can take 3-5 seconds)
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function startServer() {
  try {
    // Connect to database with retry logic for Neon
    await connectWithRetry();
    
    app.listen(PORT, () => {
      logger.info(`✓ Server running on port ${PORT} in ${config.env} mode`);
      logger.info(`✓ API available at http://localhost:${PORT}${config.apiPrefix}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('⏳ Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('⏳ Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await prisma.$disconnect();
  process.exit(1);
});

startServer();
