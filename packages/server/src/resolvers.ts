import { PubSub } from 'graphql-subscriptions';

let currentInput = '';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
  },
  Mutation: {
    updateInput: (_: any, { value }: { value: string }, { pubsub }: { pubsub: PubSub }) => {
      currentInput = value;
      pubsub.publish('INPUT_CHANGED', { inputChanged: value });
      return value;
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_: any, __: any, { pubsub }: { pubsub: PubSub }) =>
        pubsub.asyncIterator(['INPUT_CHANGED']),
    },
  },
}; 