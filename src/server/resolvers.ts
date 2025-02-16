import { PubSub } from 'graphql-subscriptions';
import { Context, UpdateInputArgs } from './types';

let currentInput = '';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
  },
  Mutation: {
    updateInput: (_: unknown, { value }: UpdateInputArgs, { pubsub }: Context) => {
      currentInput = value;
      pubsub.publish('INPUT_CHANGED', { inputChanged: value });
      return value;
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_: unknown, __: unknown, { pubsub }: Context) =>
        pubsub.asyncIterator(['INPUT_CHANGED']),
    },
  },
}; 