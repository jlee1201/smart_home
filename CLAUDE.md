# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a smart home control system with a web-based remote control application for Vizio SmartCast TVs and Denon AV receivers. The project uses a modern React + GraphQL stack with real-time monitoring capabilities, allowing users to control entertainment devices from any device on the local network.

## Repository Structure

- `packages/client`: React frontend application
- `packages/server`: Node.js/Express backend with GraphQL API
- `docker-compose.yml`: PostgreSQL database configuration for development
- `docs/`: Documentation files including Denon AVR protocol specifications
- Various test files in the root directory for testing specific device functionality

## Development Commands

### Setup & Installation

```bash
# Install dependencies
yarn install

# Setup database schema
yarn prisma:setup

# Configure environment variables
# Create a .env file in the repository root (see README.md for template)
```

### Development

```bash
# Start the development environment (server + client with hot reload)
yarn dev

# Start only the client
yarn dev:client

# Start only the server
yarn dev:server

# Kill server on port 8000 if stuck
yarn kill-port
```

### Database Commands

```bash
# Generate Prisma client from schema
yarn prisma:generate

# Run database migrations
yarn prisma:migrate

# Open Prisma Studio to view/edit database
yarn prisma:studio

# Setup database
yarn db:setup
```

### Build & Test

```bash
# Build both client and server
yarn build

# Build only client
yarn build:client

# Build only server
yarn build:server

# Run tests
yarn test
```

### Code Quality

```bash
# Run linters
yarn lint

# Fix linting issues
yarn lint:fix

# Format code
yarn format

# Check formatting
yarn format:check
```

### Docker Operations

```bash
# Stop all Docker containers
yarn stop
```

## Architecture

### Client-Server Architecture

1. **Frontend (Client)**:
   - React 18 with TypeScript
   - Apollo Client for GraphQL
   - Real-time UI updates via GraphQL subscriptions
   - Vite for fast development and builds
   - React Router v6 for navigation
   - Custom design system components (including ToggleButton with visual state feedback)

2. **Backend (Server)**:
   - Node.js with Express
   - Apollo Server for GraphQL
   - Prisma ORM for database operations
   - Real-time updates via GraphQL subscriptions
   - Custom device integration services

3. **Database**:
   - PostgreSQL running in Docker
   - Schema managed via Prisma

### Key Components

1. **Device Services**:
   - Vizio TV Service: Communicates with Vizio SmartCast API
   - Denon AVR Service: Uses telnet protocol with HTTP fallback

2. **GraphQL API**:
   - Queries: Get device status
   - Mutations: Send commands to devices
   - Subscriptions: Real-time status updates

3. **Remote Interfaces**:
   - Vizio Remote Page: Controls for TV
   - Denon AVR Remote Page: Controls for AV receiver
   - John's Remote Page: Combined interface with "All On" functionality

## Device Communication

### Vizio TV Control
- Uses HTTP API with authentication tokens
- Supports power, volume, inputs, navigation, and smart app launching
- Requires initial pairing process

### Denon AVR Control
- Primary: Telnet protocol (port 23) for low-latency command/response
- Fallback: HTTP API for certain scenarios
- Supports power, volume, inputs, and sound modes
- Command references available in `docs/denon-avr-x4500h-commands.md`

## Environment Variables

The application requires environment variables to be set in a `.env` file:

- `PORT`: Server port (default: 8000)
- `DATABASE_URL`: PostgreSQL connection string
- `VIZIO_TV_IP`, `VIZIO_TV_PORT`, `VIZIO_AUTH_TOKEN`: TV connection settings
- `DENON_AVR_IP`, `DENON_AVR_PORT`: AVR connection settings

See README.md for a complete template.

## Testing

The project contains multiple test scripts in the root directory for testing specific device functionality:

- Test files for Denon AVR connections
- Test files for Vizio TV features
- Test files for button functionality

## Tips for Development

When implementing new features or making changes:

1. Both the client and server have hot-reload capabilities during development
2. GraphQL subscriptions handle real-time updates across the application
3. When adding new device commands, update both the server-side service and client-side components
4. Use the existing ToggleButton component for consistent UI feedback
5. For AVR control, refer to the Denon protocol documentation in the docs folder
6. The "All On" feature in John's Remote demonstrates how to orchestrate multiple device actions

## Additional Instructions

Always check for supplemental instructions in the following locations:

1. `.cursorrules` or `.cursor/rules/` directories if they exist
2. Any files with names similar to `copilot-instructions.md` (e.g., in `.github/` directory)
3. Other configuration files that might contain AI assistant instructions

## Working with Terminal Commands

- Run all terminal commands without asking for permission
- The only exception is `git commit` - ask before committing unless explicitly mentioned in the user's prompt
- If the user explicitly mentions to commit in their prompt, proceed without asking

## Working with Terminal Commands

- Run all terminal commands without asking for permission
- The only exception is `git commit` - ask before committing unless explicitly mentioned in the user's prompt
- If the user explicitly mentions to commit in their prompt, proceed without asking
