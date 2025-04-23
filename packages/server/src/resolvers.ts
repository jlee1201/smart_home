import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { logger } from './utils/logger.js';

// Create an enum for error codes
export enum ErrorCode {
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// Add proper type definitions with more specific types
type ResolverContext = {
  pubsub: PubSub;
};

type ResolverParent = unknown;
type ResolverArgs<T> = { value: T };

type Resolvers = {
  Query: {
    hello: () => string;
    currentInput: () => string;
  };
  Mutation: {
    updateInput: (
      parent: ResolverParent,
      args: ResolverArgs<unknown>,
      context: ResolverContext
    ) => Promise<string>;
  };
  Subscription: {
    inputChanged: {
      subscribe: (
        parent: ResolverParent,
        args: never,
        context: ResolverContext
      ) => AsyncIterator<{ inputChanged: string }>;
    };
  };
};

// Constants
const MAX_INPUT_LENGTH = 1000;
const SUBSCRIPTION_CHANNEL = 'INPUT_CHANGED' as const;

let currentInput = '';

export const resolvers: Resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
  },
  Mutation: {
    updateInput: async (_, { value }, { pubsub }) => {
      try {
        if (typeof value !== 'string') {
          throw new GraphQLError('Invalid input value type', {
            extensions: { code: ErrorCode.BAD_USER_INPUT },
          });
        }

        if (value.length > MAX_INPUT_LENGTH) {
          throw new GraphQLError('Input value exceeds maximum length', {
            extensions: { code: ErrorCode.BAD_USER_INPUT },
          });
        }

        currentInput = value;
        await pubsub.publish(SUBSCRIPTION_CHANNEL, { inputChanged: value });
        return value;
      } catch (error) {
        logger.error('Error in updateInput mutation', { error });
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Internal server error', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([SUBSCRIPTION_CHANNEL]);
        } catch (error) {
          logger.error('Error in inputChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: ErrorCode.SUBSCRIPTION_FAILED },
          });
        }
      },
    },
  },
};
