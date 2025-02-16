import express from 'express';
import path from 'path';
import { graphqlHTTP } from 'express-graphql';
import { schema, root } from './schema';

const app = express();
const PORT = process.env.PORT || 8000;

// GraphQL endpoint
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true, // Enables GraphiQL interface for testing
}));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`GraphQL IDE available at http://localhost:${PORT}/graphql`);
}); 