import dotenv from 'dotenv';
import path from 'path';
import { developmentConfig } from './config/development';
import { productionConfig } from './config/production';
import { Config } from './types/config';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

export const config: Config = nodeEnv === 'production' 
  ? productionConfig 
  : developmentConfig;

// Allow environment variables to override config
export function overrideConfigFromEnv(currentConfig: Config): Config {
  return {
    ...currentConfig,
    server: {
      ...currentConfig.server,
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : currentConfig.server.port,
      graphql: {
        ...currentConfig.server.graphql,
        path: process.env.GRAPHQL_PATH || currentConfig.server.graphql.path,
        playground: process.env.ENABLE_GRAPHQL_PLAYGROUND === 'true' || currentConfig.server.graphql.playground,
      },
    },
  };
}

// Apply environment overrides
export default overrideConfigFromEnv(config); 