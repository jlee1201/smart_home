import { Config } from '../types/config';

export const developmentConfig: Config = {
  server: {
    port: parseInt(process.env.PORT || '8000', 10),
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true,
    },
    graphql: {
      path: '/graphql',
      playground: true,
      debug: true,
    },
  },
  logging: {
    level: 'debug',
    pretty: true,
  },
};
