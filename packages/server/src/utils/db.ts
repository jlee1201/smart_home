import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// Default database URL - using port 5433 for Docker
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@localhost:5433/smart_home';

// Create a singleton instance of PrismaClient
let prisma: PrismaClient | null = null;

try {
  // Initialize the Prisma client with database connection retries
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || DEFAULT_DB_URL,
      },
    },
    log: ['error', 'warn'],
  });
  
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore - Assign to global for development
    globalThis.__prisma = prisma;
  }
  
  logger.info('Prisma client initialized with URL:', { 
    url: process.env.DATABASE_URL || DEFAULT_DB_URL,
    masked: (process.env.DATABASE_URL || DEFAULT_DB_URL).replace(/:\/\/.*@/, '://***@') 
  });
} catch (error) {
  logger.error('Failed to initialize Prisma client', { error });
  prisma = null;
}

export { prisma };

export async function ensureDbConnection() {
  // If DATABASE_URL isn't set in environment, we need to set it for consistency
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DB_URL;
    logger.info('Setting DATABASE_URL to default:', { url: DEFAULT_DB_URL });
  }
  
  if (!prisma) {
    logger.warn('Prisma client not initialized, attempting to reinitialize');
    try {
      prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        log: ['error', 'warn'],
      });
    } catch (error) {
      logger.error('Failed to reinitialize Prisma client', { error });
      return false;
    }
  }
  
  try {
    // Test the database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    
    // If database is missing, try to create it
    try {
      logger.info('Attempting to run database setup script...');
      
      const { spawn } = await import('child_process');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const setupScript = path.resolve(__dirname, '../../prisma/setup-database.js');
      
      const setup = spawn('node', ['--loader', 'ts-node/esm', setupScript], {
        stdio: 'inherit',
        env: process.env,
      });
      
      await new Promise((resolve) => {
        setup.on('close', (code) => {
          if (code === 0) {
            logger.info('Database setup completed successfully');
          } else {
            logger.warn(`Database setup exited with code ${code}`);
          }
          resolve(null);
        });
      });
      
      // Try connection again
      try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('Database connection established after setup');
        return true;
      } catch (retryError) {
        logger.error('Still failed to connect after setup', { error: retryError });
        return false;
      }
    } catch (setupError) {
      logger.error('Failed to run database setup', { error: setupError });
      return false;
    }
  }
} 