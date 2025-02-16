import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { schema } from './schema';
import { Server } from 'http';

export const setupWebSocketServer = (httpServer: Server) => {
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  useServer(
    {
      schema,
      context: () => ({
        pubsub: {
          asyncIterator: (trigger: string) => ({
            [Symbol.asyncIterator]() {
              return {
                next() {
                  return new Promise(resolve => {
                  });
                },
              };
            },
          }),
        },
      }),
    },
    wsServer
  );
}; 