#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

// Load environment variables from .env file
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  const envVars = envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return { key: key.trim(), value: valueParts.join('=').trim() };
    });

  for (const { key, value } of envVars) {
    process.env[key] = value.replace(/^['"](.*)['"]$/, '$1'); // Remove surrounding quotes if present
  }
}

// Ensure DATABASE_URL is set, default to port 5433 (Docker) if not specified
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL environment variable is not set');
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/smart_home';
  console.info('Using default DATABASE_URL:', process.env.DATABASE_URL);
} else {
  console.info('Using DATABASE_URL from environment:', process.env.DATABASE_URL);
}

// Extract connection info from DATABASE_URL
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.substring(1); // Remove leading slash
const host = url.hostname;
const port = url.port || '5432';
const user = url.username;
const password = url.password;

console.log(`Database connection parameters: host=${host}, port=${port}, dbName=${dbName}, user=${user}`);

// Wait for PostgreSQL to be ready
function waitForPostgres() {
  return new Promise((resolve, reject) => {
    console.log(`Waiting for PostgreSQL to be ready at ${host}:${port}...`);
    
    // Use netcat to check if PostgreSQL is accepting connections
    const maxAttempts = 15;
    let attempts = 0;
    
    function check() {
      const nc = spawn('nc', ['-z', host, port]);
      
      nc.on('close', (code) => {
        if (code === 0) {
          console.log('PostgreSQL is ready!');
          resolve();
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            console.warn(`Max attempts reached. PostgreSQL is not available at ${host}:${port}`);
            // Resolve anyway to allow the process to continue
            resolve();
            return;
          }
          console.log(`Attempt ${attempts}/${maxAttempts} failed, retrying in 1 second...`);
          setTimeout(check, 1000);
        }
      });
      
      nc.on('error', (err) => {
        console.warn(`Error with netcat: ${err.message}`);
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn('Max attempts reached. Continuing anyway.');
          resolve();
          return;
        }
        setTimeout(check, 1000);
      });
    }
    
    check();
  });
}

// Run Prisma migrations
async function runMigrations() {
  try {
    await waitForPostgres();
    
    // First generate the client
    console.log('Generating Prisma client...');
    try {
      const generate = spawn('npx', ['prisma', 'generate'], {
        stdio: 'inherit',
        env: process.env,
        cwd: __dirname,
      });
      
      await new Promise((resolve) => {
        generate.on('close', (code) => {
          if (code === 0) {
            console.log('Prisma client generated successfully');
          } else {
            console.warn(`Prisma generate exited with code ${code}`);
          }
          resolve();
        });
      });
    } catch (error) {
      console.warn('Error generating Prisma client:', error);
    }
    
    // Try to run the migration
    console.log('Running Prisma migration...');
    try {
      const migrate = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'init'], {
        stdio: 'inherit',
        env: process.env,
        cwd: __dirname,
      });
      
      await new Promise((resolve) => {
        migrate.on('close', (code) => {
          if (code === 0) {
            console.log('Prisma migration completed successfully');
          } else {
            console.warn(`Prisma migration exited with code ${code}`);
          }
          resolve();
        });
      });
    } catch (error) {
      console.warn('Error running Prisma migration:', error);
    }
    
    console.log('Database setup completed');
  } catch (error) {
    console.error('Error in database setup:', error);
  }
}

runMigrations().catch(console.error); 