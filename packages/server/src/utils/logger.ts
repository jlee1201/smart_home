import { config } from '../config';

const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

function shouldLog(level: keyof typeof logLevels): boolean {
  return logLevels[level] >= logLevels[config.logging.level];
}

function formatMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
  return config.logging.pretty
    ? `${timestamp} [${level.toUpperCase()}] ${message}${metaString}`
    : JSON.stringify({ timestamp, level, message, ...meta });
}

export const logger = {
  debug(message: string, meta?: any) {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
  info(message: string, meta?: any) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, meta));
    }
  },
  warn(message: string, meta?: any) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error(message: string, meta?: any) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },
};
