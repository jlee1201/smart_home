import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  client: {
    port: number;
    apiUrl: string;
  };
  graphql: {
    path: string;
    enablePlayground: boolean;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  client: {
    port: parseInt(process.env.VITE_APP_PORT || '3000', 10),
    apiUrl: process.env.VITE_API_URL || 'http://localhost:8000',
  },
  graphql: {
    path: process.env.GRAPHQL_PATH || '/graphql',
    enablePlayground: process.env.ENABLE_GRAPHQL_PLAYGROUND === 'true',
  },
}; 