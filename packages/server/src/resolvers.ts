import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { logger } from './utils/logger.js';
import { tvService } from './services/tvService.js';
import type { TVStatus } from './services/tvService.js';

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
type TVCommandArgs = { command: string; value?: string };
type TVPairingArgs = { pin: string };

type Resolvers = {
  Query: {
    hello: () => string;
    currentInput: () => string;
    tvStatus: () => TVStatus;
    tvConnectionStatus: () => { connected: boolean };
  };
  Mutation: {
    updateInput: (
      parent: ResolverParent,
      args: ResolverArgs<unknown>,
      context: ResolverContext
    ) => Promise<string>;
    sendTVCommand: (
      parent: ResolverParent,
      args: TVCommandArgs,
      context: ResolverContext
    ) => Promise<boolean>;
    initiateTVPairing: () => Promise<{ challengeCode: string }>;
    completeTVPairing: (
      parent: ResolverParent,
      args: TVPairingArgs
    ) => Promise<{ success: boolean; authToken: string }>;
  };
  Subscription: {
    inputChanged: {
      subscribe: (
        parent: ResolverParent,
        args: never,
        context: ResolverContext
      ) => AsyncIterator<{ inputChanged: string }>;
    };
    tvStatusChanged: {
      subscribe: (
        parent: ResolverParent,
        args: never,
        context: ResolverContext
      ) => AsyncIterator<{ tvStatusChanged: TVStatus }>;
    };
  };
};

// Constants
const MAX_INPUT_LENGTH = 1000;
const INPUT_CHANNEL = 'INPUT_CHANGED' as const;
const TV_STATUS_CHANNEL = 'TV_STATUS_CHANGED' as const;

let currentInput = '';

// Initialize TV service when the server starts
(async () => {
  // Only try to initialize TV service if not running in development or explicitly enabled
  if (process.env.ENABLE_TV_CONNECTION === 'true') {
    try {
      await tvService.init();
      logger.info('TV service initialized');
    } catch (error) {
      logger.warn('Failed to initialize TV service', { error });
    }
  } else {
    logger.info('TV service initialization skipped - set ENABLE_TV_CONNECTION=true to enable');
  }
})();

export const resolvers: Resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
    tvStatus: () => tvService.getStatus(),
    tvConnectionStatus: () => ({
      connected: tvService.isConnectedToTV()
    }),
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
        await pubsub.publish(INPUT_CHANNEL, { inputChanged: value });
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
    sendTVCommand: async (_, { command, value }, { pubsub }) => {
      try {
        if (typeof command !== 'string') {
          throw new GraphQLError('Invalid command type', {
            extensions: { code: ErrorCode.BAD_USER_INPUT },
          });
        }

        // Send the command to the TV service
        const success = await tvService.sendCommand(command, value);
        
        // If command was successful, publish the updated status
        if (success) {
          const status = tvService.getStatus();
          await pubsub.publish(TV_STATUS_CHANNEL, { tvStatusChanged: status });
        }

        return success;
      } catch (error) {
        logger.error('Error in sendTVCommand mutation', { error });
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Internal server error', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
    initiateTVPairing: async () => {
      try {
        const challengeCode = await tvService.initiatePairing();
        return { challengeCode };
      } catch (error) {
        logger.error('Error initiating TV pairing', { error });
        throw new GraphQLError('Failed to initiate TV pairing', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
    completeTVPairing: async (_, { pin }) => {
      try {
        const authToken = await tvService.completePairing(pin);
        return { 
          success: true, 
          authToken 
        };
      } catch (error) {
        logger.error('Error completing TV pairing', { error });
        throw new GraphQLError('Failed to complete TV pairing', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([INPUT_CHANNEL]);
        } catch (error) {
          logger.error('Error in inputChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: ErrorCode.SUBSCRIPTION_FAILED },
          });
        }
      },
    },
    tvStatusChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([TV_STATUS_CHANNEL]);
        } catch (error) {
          logger.error('Error in tvStatusChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: ErrorCode.SUBSCRIPTION_FAILED },
          });
        }
      },
    },
  },
};
