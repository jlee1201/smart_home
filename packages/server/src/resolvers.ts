import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { logger } from './utils/logger.js';
import { tvService } from './services/tvService.js';
import { denonAvrService } from './services/denonAvrService.js';

// Create an enum for error codes
export enum ErrorCode {
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// Constants for the subscription channels
export const INPUT_CHANGED_CHANNEL = 'INPUT_CHANGED';
export const TV_STATUS_CHANNEL = 'TV_STATUS_CHANGED';
export const DENON_AVR_STATUS_CHANNEL = 'DENON_AVR_STATUS_CHANGED';
export const ERROR_LOG_CHANNEL = 'ERROR_LOG_CHANGED';
export const BUTTON_DEBUG_CHANNEL = 'BUTTON_DEBUG';
export const APP_CHANGED_CHANNEL = 'APP_CHANGED';

// Types
type ResolverContext = { pubsub: PubSub };
type TVCommandArgs = { command: string; value?: string };
type TVPairingArgs = { pin: string };
type DenonAvrCommandArgs = { command: string; value?: string };

// Maximum input length
const MAX_INPUT_LENGTH = 1000;

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
  
  // Initialize Denon AVR service with detailed logging
  try {
    logger.info('Initializing Denon AVR service...');
    logger.info('Environment settings', { 
      ENABLE_AVR_CONNECTION: process.env.ENABLE_AVR_CONNECTION,
      simulationMode: process.env.ENABLE_AVR_CONNECTION !== 'true',
      DENON_AVR_IP: process.env.DENON_AVR_IP,
      DENON_AVR_PORT: process.env.DENON_AVR_PORT
    });
    
    const initResult = await denonAvrService.init();
    logger.info('Denon AVR service initialized', { 
      success: initResult, 
      isConnected: denonAvrService.isConnectedToAVR() 
    });
    
    // Get initial status
    const status = denonAvrService.getStatus();
    logger.info('Initial Denon AVR status', { status });
    
  } catch (error) {
    logger.warn('Failed to initialize Denon AVR service', { error });
  }
})();

// Define the Resolvers type
type Resolvers = {
  Query: {
    hello: () => string;
    currentInput: () => string;
    tvStatus: () => any;
    tvConnectionStatus: () => { connected: boolean };
    denonAvrStatus: () => any;
    denonAvrConnectionStatus: () => { connected: boolean };
    denonAvrReachable: () => Promise<boolean>;
    errorLogs: () => { id: string; timestamp: number; message: string; details?: string }[];
  };
  Mutation: {
    updateInput: (
      parent: any,
      args: { value: string },
      context: ResolverContext
    ) => Promise<string>;
    sendTVCommand: (
      parent: any,
      args: TVCommandArgs,
      context: ResolverContext
    ) => Promise<boolean>;
    sendDenonAvrCommand: (
      parent: any,
      args: DenonAvrCommandArgs,
      context: ResolverContext
    ) => Promise<boolean>;
    initiateTVPairing: () => Promise<{ challengeCode: string }>;
    completeTVPairing: (
      parent: any,
      args: TVPairingArgs
    ) => Promise<{ success: boolean; authToken: string }>;
    resetTVConnection: () => Promise<boolean>;
    cancelTVPairing: () => Promise<boolean>;
    clearErrorLogs: (
      parent: any,
      args: any,
      context: ResolverContext
    ) => Promise<boolean>;
    syncDevices: (
      parent: any,
      args: any,
      context: ResolverContext
    ) => Promise<boolean>;
  };
  Subscription: {
    inputChanged: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
    tvStatusChanged: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
    denonAvrStatusChanged: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
    errorLogChanged: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
    buttonDebugInfo: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
    appChanged: {
      subscribe: (
        parent: any,
        args: any,
        context: ResolverContext
      ) => any;
    };
  };
};

let currentInput = '';

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
    denonAvrReachable: () => denonAvrService.isReachable(),
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
        await pubsub.publish(INPUT_CHANGED_CHANNEL, { inputChanged: value });
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
    clearErrorLogs: async (_, _args, { pubsub }) => {
      try {
        errorLogs.length = 0; // Clear the array
        await pubsub.publish(ERROR_LOG_CHANNEL, { errorLogChanged: errorLogs });
        return true;
      } catch (error) {
        logger.error('Error clearing error logs', { error });
        return false;
      }
    },
    syncDevices: async (_, _args, { pubsub }) => {
      try {
        logger.info('Starting "All On" operation for John\'s Remote');
        
        // Get current status of both devices
        const tvStatus = tvService.getStatus();
        const avrStatus = denonAvrService.getStatus();
        
        let needsAction = false;
        
        // Step 1: Power on TV if not already on
        if (!tvStatus.isPoweredOn) {
          logger.info('Powering on TV');
          const tvPowerSuccess = await tvService.sendCommand('POWER');
          if (!tvPowerSuccess) {
            logger.error('Failed to power on TV during All On operation');
            await addErrorToLog(pubsub, 'All On failed: Could not power on TV', '');
            return false;
          }
          needsAction = true;
          // Wait a moment for TV to power on
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Step 2: Power on Denon AVR if not already on
        if (!avrStatus.isPoweredOn) {
          logger.info('Powering on Denon AVR');
          const avrPowerSuccess = await denonAvrService.sendCommand('POWER_ON');
          if (!avrPowerSuccess) {
            logger.error('Failed to power on Denon AVR during All On operation');
            await addErrorToLog(pubsub, 'All On failed: Could not power on Denon AVR', '');
            return false;
          }
          needsAction = true;
          // Wait a moment for the AVR to power on
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Step 3: Set Denon AVR to TV input if not already set
        if (avrStatus.input !== 'TV') {
          logger.info('Setting Denon AVR to TV input');
          const inputSuccess = await denonAvrService.sendCommand('INPUT_TV');
          if (!inputSuccess) {
            logger.error('Failed to set Denon AVR to TV input during All On operation');
            await addErrorToLog(pubsub, 'All On failed: Could not set Denon AVR to TV input', '');
            return false;
          }
          needsAction = true;
        }
        
        // Step 4: Set volume to 55 if AVR is powered on
        if (avrStatus.isPoweredOn || needsAction) {
          logger.info('Setting Denon AVR volume to 55');
          const volumeSuccess = await denonAvrService.sendCommand('SET_VOLUME', '55');
          if (!volumeSuccess) {
            logger.error('Failed to set Denon AVR volume during All On operation');
            await addErrorToLog(pubsub, 'All On failed: Could not set Denon AVR volume to 55', '');
            return false;
          }
          needsAction = true;
        }
        
        if (needsAction) {
          logger.info('All On operation completed successfully');
        } else {
          logger.info('All On operation - no action needed, devices already in desired state');
        }
        
        // Publish updated statuses
        const updatedTvStatus = tvService.getStatus();
        const updatedAvrStatus = denonAvrService.getStatus();
        await pubsub.publish(TV_STATUS_CHANNEL, { tvStatusChanged: updatedTvStatus });
        await pubsub.publish(DENON_AVR_STATUS_CHANNEL, { denonAvrStatusChanged: updatedAvrStatus });
        
        return true;
      } catch (error) {
        logger.error('Error in syncDevices (All On) mutation', { error });
        await addErrorToLog(pubsub, 'All On failed: Internal error occurred', JSON.stringify(error));
        return false;
      }
    },
  },
  Subscription: {
    inputChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([INPUT_CHANGED_CHANNEL]);
        } catch (error) {
          logger.error('Error in inputChanged subscription', { error });
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
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
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
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
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
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
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
          });
        }
      },
    },
    buttonDebugInfo: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([BUTTON_DEBUG_CHANNEL]);
        } catch (error) {
          logger.error('Error in buttonDebugInfo subscription', { error });
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
          });
        }
      },
    },
    appChanged: {
      subscribe: (_, __, { pubsub }) => {
        try {
          return pubsub.asyncIterator([APP_CHANGED_CHANNEL]);
        } catch (error) {
          logger.error('Error in appChanged subscription', { error });
          throw new GraphQLError('Subscription error', {
            extensions: { code: ErrorCode.INTERNAL_ERROR },
          });
        }
      },
    },
  },
};
