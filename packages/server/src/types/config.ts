export interface Config {
  server: {
    port: number;
    cors: {
      origin: string[];
      credentials: boolean;
    };
    graphql: {
      path: string;
      playground: boolean;
      debug: boolean;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty: boolean;
  };
} 