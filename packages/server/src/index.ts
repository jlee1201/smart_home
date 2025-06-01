import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { pubsub } from './pubsub.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { ensureDbConnection } from './utils/db.js';
import { applyTVFixes } from './utils/tvFixes.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GraphQLSchema } from 'graphql';

// Define a compatible WebSocketServer type that works with useServer
type CompatibleWebSocketServer = WebSocketServer & {
  options?: {
    WebSocket?: any;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server state tracking for HMR support
let httpServer: ReturnType<typeof createServer> | null = null;
let serverCleanup: { dispose: () => void | Promise<void> } | null = null;
let wsServer: WebSocketServer | null = null;
let currentPort = config.server.port;

// Store pubsub globally for access from other components
(global as any).pubsub = pubsub;

async function stopServer() {
  // Clean up services first
  try {
    const { denonAvrService } = await import('./services/denonAvrService.js');
    const { tvService } = await import('./services/tvService.js');
    
    logger.info('Cleaning up services');
    denonAvrService.cleanup();
    tvService.stopPolling();
  } catch (error) {
    logger.warn('Error cleaning up services', { error });
  }

  // Close HTTP server
  const closeHttpServer = new Promise<void>((resolve) => {
    if (httpServer) {
      logger.info('Closing HTTP server');
      httpServer.close(() => {
        logger.info('HTTP server closed');
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
  
  // Wait for HTTP server to close before cleaning up WebSocket resources
  await closeHttpServer;
  
  // Then clean up WebSocket resources
  if (serverCleanup) {
    try {
      logger.info('Disposing GraphQL subscription server');
      await serverCleanup.dispose();
      serverCleanup = null;
    } catch (error) {
      // Check if error is empty or not an object
      if (!error || typeof error !== 'object' || Object.keys(error).length === 0) {
        logger.warn('Empty error while disposing GraphQL subscription server. This is likely benign and related to no active connections.');
      } else {
        logger.warn('Error while disposing GraphQL subscription server', { 
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack
          } : error 
        });
      }
      // Continue shutdown even if there's an error
    }
  }
  
  if (wsServer) {
    try {
      logger.info('Closing WebSocket server');
      wsServer.close();
      wsServer = null;
    } catch (error) {
      logger.warn('Error while closing WebSocket server', { error });
      // Continue shutdown even if there's an error
    }
  }
}

// Handle graceful shutdown for HMR
if (process.env.NODE_ENV !== 'production') {
  const signals = ['SIGTERM', 'SIGINT'] as const;
  
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`${signal} received, shutting down server`);
      try {
        await stopServer();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error}`);
        process.exit(1);
      }
    });
  }
}

async function startServer() {
  try {
    // Apply TV fixes for better compatibility with Vizio TV models
    applyTVFixes();
    
    // Ensure database connection before starting the server
    const dbConnected = await ensureDbConnection();
    if (!dbConnected) {
      logger.warn('Failed to connect to database - continuing anyway with limited functionality');
      // We'll continue without a database connection
    } else {
      logger.info('Database connection established');
    }

    const app = express();
    httpServer = createServer(app);

    // Add error handling for schema creation
    let schema: GraphQLSchema;
    try {
      schema = makeExecutableSchema({ typeDefs, resolvers });
      logger.info('GraphQL schema created successfully');
    } catch (schemaError) {
      logger.error('Failed to create GraphQL schema:', { error: schemaError });
      throw schemaError;
    }

    // Create WebSocketServer with proper error handling
    try {
      // Fix the WebSocketServer instantiation
      wsServer = new WebSocketServer({
        server: httpServer,
        path: config.server.graphql.path,
      });
      logger.info('WebSocketServer created successfully');
    } catch (wsError) {
      logger.error('Failed to create WebSocketServer:', { error: wsError });
      throw wsError;
    }

    // Setup GraphQL over WebSocket with proper error handling
    try {
      // Fixed typing issue by ensuring the useServer is using the correct WebSocketServer type
      serverCleanup = useServer(
        {
          schema,
          context: () => {
            logger.info('Creating WebSocket context with pubsub');
            return { pubsub };
          },
          onConnect: () => {
            logger.info('Client connected to WebSocket');
          },
          onDisconnect: () => {
            logger.info('Client disconnected from WebSocket');
          },
        },
        wsServer as unknown as CompatibleWebSocketServer
      );
      logger.info('WebSocket GraphQL server setup successfully');
    } catch (useServerError) {
      logger.error('Failed to setup GraphQL over WebSocket:', { error: useServerError });
      throw useServerError;
    }

    const server = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                if (serverCleanup) {
                  await serverCleanup.dispose();
                }
              },
            };
          },
        },
      ],
      includeStacktraceInErrorResponses: config.server.graphql.debug,
    });

    await server.start();
    logger.info('Apollo Server started successfully');

    app.use(
      config.server.graphql.path,
      cors<cors.CorsRequest>(config.server.cors),
      express.json(),
      expressMiddleware(server, {
        context: async () => {
          logger.info('Creating HTTP context with pubsub');
          return { pubsub };
        },
      })
    );

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      const clientDistPath = path.resolve(__dirname, '../../../packages/client/dist');
      app.use(express.static(clientDistPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      });
    }

    // First, find the lines with the reported TypeScript errors (218 and 231)
    // For line 218 with error: error TS18047: 'httpServer' is possibly 'null'.
    if (httpServer) {
      // WebSocket server - only initialize if httpServer exists
      // REMOVE: wsServer.applyMiddleware({ app, path: '/graphql' });
      
      // Apply the WebSocket handlers to the server - but only if useServer() didn't already do it
      // The useServer() function from graphql-ws already sets up the handlers, so we don't need to do it manually
      // This was causing the "server.handleUpgrade() called more than once" error
      
      /* REMOVING THIS BLOCK TO AVOID DUPLICATE HANDLERS
      if (wsServer) {
        httpServer.on('upgrade', function (request, socket, head) {
          if (wsServer) {
            wsServer.handleUpgrade(request, socket, head, function (ws) {
              if (wsServer) {
                wsServer.emit('connection', ws, request);
              }
            });
          }
        });
      }
      */
    }

    // Start the server
    try {
      await new Promise<void>((resolve, reject) => {
        if (!httpServer) {
          reject(new Error('HTTP server is null'));
          return;
        }
        
        // Add error handler for port in use errors
        httpServer.on('error', (error: Error & { code?: string }) => {
          if (error.code === 'EADDRINUSE') {
            logger.warn(`Port ${currentPort} is already in use, trying port ${currentPort + 1}`);
            currentPort += 1;
            
            // Retry with new port
            httpServer?.listen({ port: currentPort }, () => {
              logger.info(`Server started on fallback port ${currentPort}`);
              resolve();
            });
          } else {
            reject(error);
          }
        });
        
        // Initial attempt to listen on the preferred port
        httpServer.listen({ port: currentPort }, () => {
          logger.info(`Server started on port ${currentPort}`);
          resolve();
        });
      });
      
      logger.info(
        `🚀 Server ready at http://localhost:${currentPort}${config.server.graphql.path}`
      );
      
      // For HMR - log restart message
      if (process.env.NODE_ENV !== 'production') {
        logger.info('HMR enabled - server will automatically reload on changes');
      }
    } catch (error) {
      // Handle specific errors
      const typedError = error as Error & { code?: string };
      logger.error('Failed to start server', { 
        error: typedError.message || 'Unknown error',
        stack: typedError.stack,
        code: typedError.code
      });
      throw error;
    }
  } catch (error) {
    logger.error('Failed to start server:', { error });
    throw error;
  }
}

// Improve the top-level try-catch
try {
  // Ensure any existing server is stopped before starting a new one
  (async () => {
    try {
      await stopServer();
      await startServer();
    } catch (err) {
      // Convert the error to a proper error object if it's not one already
      const error = err instanceof Error ? err : new Error(JSON.stringify(err));
      console.error('Error caught inside startServer():', error);
      logger.error('Failed to start server:', { 
        error: error.message || 'Unknown error object',
        stack: error.stack
      });
      process.exit(1);
    }
  })();
} catch (topLevelError) {
  // Catch errors that might happen synchronously before or during the startServer call
  const error = topLevelError instanceof Error ? topLevelError : new Error(JSON.stringify(topLevelError));
  console.error('Synchronous top-level error during startup:', error);
  // Attempt to log using the logger if available, otherwise console
  if (typeof logger !== 'undefined' && logger?.error) {
     logger.error('Synchronous top-level error:', { 
       error: error.message,
       stack: error.stack
     });
  }
  process.exit(1);
}

// For line 231 with error: error TS18046: 'error' is of type 'unknown'.
process.on('uncaughtException', (error: unknown) => {
  if (error instanceof Error) {
    logger.error('Uncaught exception', { 
      message: error.message,
      stack: error.stack 
    });
  } else {
    logger.error('Uncaught exception (non-Error object)', { error });
  }
});
