import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { pubsub } from './pubsub';
import config from './config';
import { logger } from './utils/logger';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: config.server.graphql.path,
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    includeStacktraceInErrorResponses: config.server.graphql.debug,
  });

  await server.start();

  app.use(
    config.server.graphql.path,
    cors<cors.CorsRequest>(config.server.cors),
    express.json(),
    expressMiddleware(server, {
      context: async () => ({ pubsub }),
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

  await new Promise<void>(resolve => httpServer.listen(config.server.port, resolve));

  logger.info(
    `🚀 Server ready at http://localhost:${config.server.port}${config.server.graphql.path}`
  );
}

startServer().catch(err => {
  logger.error('Failed to start server:', { error: err.message });
  process.exit(1);
});
