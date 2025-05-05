# Smart Home - Vizio TV Control

This project provides a web-based remote control for Vizio SmartCast TVs, with features including:

- Power control
- Volume adjustment
- Channel changing
- Input selection
- Media playback controls
- Smart app launching
- Navigation controls

## Setup

### Prerequisites

- Node.js 18 or later
- Yarn package manager
- Docker and Docker Compose
- A Vizio SmartCast-enabled TV on the same network

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   yarn install
   ```

### Vizio TV Configuration

To connect to your Vizio TV, you need to create a `.env` file in the repository root directory with the following settings:

```
# Server configuration
PORT=8000

# Database configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_home

# Vizio TV configuration
ENABLE_TV_CONNECTION=true
VIZIO_TV_IP=192.168.1.100  # Replace with your Vizio TV's IP address
VIZIO_TV_PORT=7345         # Default Vizio SmartCast API port
VIZIO_AUTH_TOKEN=          # Will be filled after pairing with TV
VIZIO_DEVICE_NAME="Smart Home Remote"
```

**Finding your TV's IP address:**
- Check your router's DHCP client list
- Use a network scanner like "Fing" app
- Check the network settings on your TV

### Running the Application

1. Start the development server:
   ```
   yarn dev
   ```
   
   This will:
   - Start a PostgreSQL database using Docker
   - Run database migrations
   - Start the server and client applications

2. Open the application in your browser at `http://localhost:3000`

3. Navigate to the "TV Setup" page to pair with your TV

4. Follow the on-screen instructions to complete the pairing process
   (The auth token will be automatically stored in the database)

5. Once paired, use the "TV Remote" page to control your TV

### Database Management

- To view the database with a UI tool: `yarn prisma:studio`
- To update the database schema: Edit `packages/server/prisma/schema.prisma` and run `yarn prisma:migrate`

## Features

- **Real-time Updates**: TV status changes (power, volume, input, etc.) are reflected immediately in the interface
- **Smart Home Integration**: Designed to be part of a larger smart home system
- **Responsive Design**: Works on desktop and mobile devices
- **Persistent Configuration**: TV settings and auth tokens are stored in a database

## Technical Details

This application uses:

- React with TypeScript for the frontend
- GraphQL for API communication
- Apollo for GraphQL client/server implementation
- Vizio SmartCast API for TV control
- PostgreSQL database with Prisma ORM
- Docker for containerization

## Troubleshooting

- **TV Not Connecting**: Ensure your TV is powered on and on the same network
- **Pairing Issues**: Try power cycling your TV and restarting the application
- **Command Failures**: Some commands may not be supported by all Vizio TV models
- **Database Issues**: Check Docker is running and the database connection is working 