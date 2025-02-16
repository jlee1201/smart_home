import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { logger } from './utils/logger';

let currentInput = '';

export const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
  },
  Mutation: {
    updateInput: (_: unknown, { value }: { value: unknown }, { pubsub }: { pubsub: PubSub }) => {
      try {
        if (typeof value !== 'string') {
          // noinspection ExceptionCaughtLocallyJS
          throw new GraphQLError('Invalid input value type', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (value.length > 1000) {
          // noinspection ExceptionCaughtLocallyJS
          throw new GraphQLError('Input value exceeds maximum length', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        currentInput = value;
        pubsub.publish('INPUT_CHANGED', { inputChanged: value }).then();
        return value;
      } catch (error) {
        logger.error('Error in updateInput mutation', { error });
        throw error;
      }
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_: unknown, __: unknown, { pubsub }: { pubsub: PubSub }) => {
        try {
          return pubsub.asyncIterator(['INPUT_CHANGED']);
        } catch (error) {
          logger.error('Error in inputChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: 'SUBSCRIPTION_FAILED' },
          });
        }
      },
    },
  },
};
