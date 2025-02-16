import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { graphqlHTTP } from 'express-graphql';
import { schema, root } from './schema';
import { config } from './config';
import { setupWebSocketServer } from './websocket';

const app = express();
const httpServer = createServer(app);
const { port } = config.server;
const { path: graphqlPath, enablePlayground } = config.graphql;

setupWebSocketServer(httpServer);

// GraphQL endpoint
app.use(graphqlPath, graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: enablePlayground,
}));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`GraphQL IDE available at http://localhost:${port}${graphqlPath}`);
});
