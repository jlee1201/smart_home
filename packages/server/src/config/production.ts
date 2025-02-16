import { Config } from '../types/config';

export const productionConfig: Config = {
  server: {
    port: parseInt(process.env.PORT || '80', 10),
    cors: {
      origin: [process.env.CLIENT_URL || 'https://your-domain.com'],
      credentials: true,
    },
    graphql: {
      path: '/graphql',
      playground: false,
      debug: false,
    },
  },
  logging: {
    level: 'info',
    pretty: false,
  },
}; 