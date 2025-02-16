import { config } from '../config';

// Ensure we're using test environment
process.env.NODE_ENV = 'test';

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}; 