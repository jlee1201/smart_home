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
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GraphQLSchema } from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server state tracking for HMR support
let httpServer: ReturnType<typeof createServer> | null = null;
let serverCleanup: { dispose: () => void | Promise<void> } | null = null;
let wsServer: WebSocketServer | null = null;

async function stopServer() {
  // Close HTTP server first
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
        wsServer
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

    await new Promise<void>(resolve => {
      if (httpServer) {
        httpServer.listen(config.server.port, resolve);
      } else {
        resolve(); // Should never happen, but needed to satisfy TypeScript
      }
    });

    logger.info(
      `🚀 Server ready at http://localhost:${config.server.port}${config.server.graphql.path}`
    );
    
    // For HMR - log restart message
    if (process.env.NODE_ENV !== 'production') {
      logger.info('HMR enabled - server will automatically reload on changes');
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
