import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { createHandler } from 'graphql-http/lib/use/express';
import { root, schema } from './schema';
import { config } from './config';
import { setupWebSocketServer } from './websocket';

const app = express();
const httpServer = createServer(app);
const { port } = config.server;
const { path: graphqlPath } = config.graphql;

setupWebSocketServer(httpServer);

// GraphQL endpoint
app.use(graphqlPath, createHandler({
  schema,
  rootValue: root,
  context: () => (
    {}
  ),
  validationRules: [],
}));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist/client')));

// Handle React routing, return all requests to React app
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`GraphQL IDE available at http://localhost:${port}${graphqlPath}`);
});
