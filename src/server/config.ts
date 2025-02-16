import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file
dotenv.config({ path: resolve(__dirname, '../../.env') });

interface Config {
  server: {
    port: number;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
  },
};
