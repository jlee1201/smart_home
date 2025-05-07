#!/bin/bash

echo "=== Resetting Denon AVR Environment and Server ==="

# 1. Kill all node processes
echo "1. Stopping all Node.js processes..."
pkill node

# 2. Fix the .env file
echo "2. Creating fixed .env file..."

cat > .env << EOL
# Database configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/smart_home

# Server configuration
PORT=8000
NODE_ENV=development
ENABLE_GRAPHQL_PLAYGROUND=true

# Feature flags - IMPORTANT: must be 'true' as string
ENABLE_AVR_CONNECTION=true
ENABLE_TV_CONNECTION=true

# TV configuration
VIZIO_TV_IP=192.168.50.113
VIZIO_TV_PORT=7345
VIZIO_DEVICE_NAME="Smart Home Remote"

# Denon AVR configuration
DENON_AVR_IP=192.168.50.98
DENON_AVR_PORT=23
EOL

echo "Fixed .env file created."

# 3. Verify environment variables
echo "3. Verifying fixed .env file..."
cat .env

# 4. Start the server in development mode
echo "4. Starting the server (Ctrl+C to exit)..."
cd packages/server && npm run dev 