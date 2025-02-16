import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../schema';
import { resolvers } from '../resolvers';
import { PubSub } from 'graphql-subscriptions';

export function createTestServer() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const pubsub = new PubSub();

  const server = new ApolloServer({
    schema,
  });

  return {
    server,
    schema,
    pubsub,
    async executeOperation(query: string, variables = {}) {
      return server.executeOperation(
        {
          query,
          variables,
        },
        {
          contextValue: { pubsub },
        }
      );
    },
  };
}
