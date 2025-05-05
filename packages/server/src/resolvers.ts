import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { logger } from './utils/logger.js';
import { tvService } from './services/tvService.js';
import type { TVStatus } from './services/tvService.js';
import { denonAvrService } from './services/denonAvrService.js';
import type { DenonAVRStatus } from './services/denonAvrService.js';

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
type DenonAvrCommandArgs = { command: string; value?: string };

type Resolvers = {
  Query: {
    hello: () => string;
    currentInput: () => string;
    tvStatus: () => TVStatus;
    tvConnectionStatus: () => { connected: boolean };
    denonAvrStatus: () => DenonAVRStatus;
    denonAvrConnectionStatus: () => { connected: boolean };
    errorLogs: () => { id: string; timestamp: number; message: string; details?: string }[];
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
    sendDenonAvrCommand: (
      parent: ResolverParent,
      args: DenonAvrCommandArgs,
      context: ResolverContext
    ) => Promise<boolean>;
    initiateTVPairing: () => Promise<{ challengeCode: string }>;
    completeTVPairing: (
      parent: ResolverParent,
      args: TVPairingArgs
    ) => Promise<{ success: boolean; authToken: string }>;
    resetTVConnection: () => Promise<boolean>;
    cancelTVPairing: () => Promise<boolean>;
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
    denonAvrStatusChanged: {
      subscribe: (
        parent: ResolverParent,
        args: never,
        context: ResolverContext
      ) => AsyncIterator<{ denonAvrStatusChanged: DenonAVRStatus }>;
    };
    errorLogChanged: {
      subscribe: (
        parent: ResolverParent,
        args: never,
        context: ResolverContext
      ) => AsyncIterator<{ errorLogChanged: { id: string; timestamp: number; message: string; details?: string }[] }>;
    };
  };
};

// Constants
const MAX_INPUT_LENGTH = 1000;
const INPUT_CHANNEL = 'INPUT_CHANGED' as const;
const TV_STATUS_CHANNEL = 'TV_STATUS_CHANGED' as const;
const DENON_AVR_STATUS_CHANNEL = 'DENON_AVR_STATUS_CHANGED' as const;
const ERROR_LOG_CHANNEL = 'ERROR_LOG_CHANGED' as const;

let currentInput = '';
// Create an array to store recent errors
const errorLogs: { id: string; timestamp: number; message: string; details?: string }[] = [];
const MAX_ERROR_LOGS = 50; // Maximum number of errors to keep

// Helper function to add an error to the log
export const addErrorToLog = async (pubsub: PubSub, message: string, details?: string) => {
  const error = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    timestamp: Date.now(),
    message,
    details
  };
  
  // Add to beginning of array
  errorLogs.unshift(error);
  
  // Trim array if it exceeds the maximum size
  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.length = MAX_ERROR_LOGS;
  }
  
  // Publish the updated error logs
  if (pubsub) {
    await pubsub.publish(ERROR_LOG_CHANNEL, { errorLogChanged: errorLogs });
  }
  
  return error;
};

// Initialize services when the server starts
(async () => {
  // Initialize TV service
  try {
    await tvService.init();
    logger.info('TV service initialized');
  } catch (error) {
    logger.warn('Failed to initialize TV service', { error });
  }
  
  // Initialize Denon AVR service
  try {
    await denonAvrService.init();
    logger.info('Denon AVR service initialized');
  } catch (error) {
    logger.warn('Failed to initialize Denon AVR service', { error });
  }
})();

export const resolvers: Resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    currentInput: () => currentInput,
    tvStatus: () => tvService.getStatus(),
    tvConnectionStatus: () => {
      // When connection status is requested, ensure it reflects current reality
      // by actively checking if the TV is still connected
      const isConnected = tvService.isConnectedToTV();
      logger.debug('TV connection status requested', { isConnected });
      return { connected: isConnected };
    },
    denonAvrStatus: () => denonAvrService.getStatus(),
    denonAvrConnectionStatus: () => ({
      connected: denonAvrService.isConnectedToAVR()
    }),
    errorLogs: () => errorLogs,
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
    sendDenonAvrCommand: async (_, { command, value }, { pubsub }) => {
      try {
        if (typeof command !== 'string') {
          throw new GraphQLError('Invalid command type', {
            extensions: { code: ErrorCode.BAD_USER_INPUT },
          });
        }

        // Send the command to the Denon AVR service
        const success = await denonAvrService.sendCommand(command, value);
        
        // If command was successful, publish the updated status
        if (success) {
          const status = denonAvrService.getStatus();
          await pubsub.publish(DENON_AVR_STATUS_CHANNEL, { denonAvrStatusChanged: status });
        }

        return success;
      } catch (error) {
        logger.error('Error in sendDenonAvrCommand mutation', { error });
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
        // Reset the connection first to ensure a clean pairing
        await tvService.resetTVConnection();
        
        // Add a delay before initiating to give TV time to clear state
        logger.info('Waiting a moment before initiating pairing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to cancel any existing pairing sessions directly
        const vizioApi = tvService.getVizioApi();
        if (vizioApi) {
          try {
            await vizioApi.cancelPairing();
            logger.info('Cancelled any existing pairing sessions before initiation');
            // Add a short delay after cancellation
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (cancelError) {
            logger.warn('Error cancelling existing pairings, continuing anyway', { 
              error: cancelError instanceof Error 
                ? cancelError.message 
                : String(cancelError)
            });
          }
        }
        
        // Now try to initiate pairing
        const challengeCode = await tvService.initiatePairing();
        return { challengeCode };
      } catch (error) {
        logger.error('Error initiating TV pairing', { 
          error: error instanceof Error 
            ? { message: error.message, stack: error.stack } 
            : String(error)
        });
        
        // If there's a blocked error, provide more specific information
        if (error instanceof Error && error.message && error.message.includes('BLOCKED')) {
          throw new GraphQLError('TV pairing is blocked. Please try resetting the TV connection or restarting your TV.', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
          });
        }
        
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
      } catch (error: any) {
        logger.error('Error completing TV pairing', { error: error?.message || 'Unknown error' });
        throw new GraphQLError('Failed to complete TV pairing', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
    resetTVConnection: async () => {
      try {
        return await tvService.resetTVConnection();
      } catch (error: any) {
        logger.error('Error resetting TV connection', { error: error?.message || 'Unknown error' });
        throw new GraphQLError('Failed to reset TV connection', {
          extensions: { code: ErrorCode.INTERNAL_ERROR },
        });
      }
    },
    cancelTVPairing: async () => {
      try {
        logger.info('Attempting to cancel any existing TV pairing sessions');
        const vizioApi = tvService.getVizioApi();
        if (!vizioApi) {
          logger.warn('No Vizio API instance available to cancel pairing');
          throw new Error('TV connection not initialized');
        }
        
        const success = await vizioApi.cancelPairing();
        return success;
      } catch (error: any) {
        logger.error('Error canceling TV pairing', { error: error?.message || 'Unknown error' });
        throw new GraphQLError('Failed to cancel TV pairing', {
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
    denonAvrStatusChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([DENON_AVR_STATUS_CHANNEL]);
        } catch (error) {
          logger.error('Error in denonAvrStatusChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: ErrorCode.SUBSCRIPTION_FAILED },
          });
        }
      },
    },
    errorLogChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([ERROR_LOG_CHANNEL]);
        } catch (error) {
          logger.error('Error in errorLogChanged subscription', { error });
          throw new GraphQLError('Subscription failed', {
            extensions: { code: ErrorCode.SUBSCRIPTION_FAILED },
          });
        }
      },
    },
  },
};
