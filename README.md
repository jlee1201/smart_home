# Smart Home - Vizio TV Control

A web-based remote control application for Vizio SmartCast TVs that provides complete control over your television from any device on your network.

## Features

- **TV Control**
  - Power on/off
  - Volume adjustment
  - Channel navigation
  - Input selection
  - Media playback controls (play, pause, stop, etc.)
  - Smart app launching
  - Directional navigation

- **Real-time Updates**: TV status changes are reflected immediately in the interface
- **Smart Home Integration**: Designed to be part of a larger smart home system
- **Responsive Design**: Works on desktop and mobile devices
- **Persistent Configuration**: TV settings and auth tokens are stored in a database

## Getting Started

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

To connect to your Vizio TV, create a `.env` file in the repository root with:

```
# Server configuration
PORT=8000

# Database configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_home

# Vizio TV configuration
ENABLE_TV_CONNECTION=true
VIZIO_TV_IP=192.168.1.100  # Replace with your TV's IP address
VIZIO_TV_PORT=7345         # Default Vizio SmartCast API port
VIZIO_AUTH_TOKEN=          # Will be filled after pairing
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

2. Access the application at `http://localhost:3000`

3. Navigate to "TV Setup" to pair with your TV

4. Follow the on-screen instructions to complete pairing

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **API Client**: Apollo Client
- **UI**: Custom components with React Icons
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **API**: GraphQL with Apollo Server
- **Subscriptions**: GraphQL Subscriptions for real-time updates
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Containerization**: Docker & Docker Compose
- **TV Control**: Custom implementation of the Vizio SmartCast API

### Third-Party Resources
- **Vizio SmartCast API Documentation**: This project's TV control functionality is based on the [Vizio SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API).
- **vizio-smart-cast Library**: Implementation references from [heathbar/vizio-smart-cast](https://github.com/heathbar/vizio-smart-cast) JavaScript library.
- **Denon AVR Protocol Documentation**: A comprehensive reference for the Denon network protocol is available in the [docs/denon-protocol.pdf](docs/denon-protocol.pdf) file.

### Supported Vizio TV Apps
The application supports launching the following apps on compatible Vizio SmartCast TVs:
- Netflix (NAME_SPACE: 3, APP_ID: 1)
- YouTube TV (NAME_SPACE: 5, APP_ID: 3)
- Amazon Prime Video (NAME_SPACE: 3, APP_ID: 3)
- Disney+ (NAME_SPACE: 4, APP_ID: 75)
- Hulu (NAME_SPACE: 2, APP_ID: 3)
- Plex (NAME_SPACE: 2, APP_ID: 9)
- Vudu (NAME_SPACE: 2, APP_ID: 21, with custom message URL)
- AsianCrush (NAME_SPACE: 2, APP_ID: 27, with custom message URL)
- Haystack TV (NAME_SPACE: 0, APP_ID: 898AF734, with custom message)
- XUMO (NAME_SPACE: 0, APP_ID: 36E1EA1F, with custom message)
- Pluto TV (NAME_SPACE: 0, APP_ID: E6F74C01, with custom message)

Additional apps may be added in future updates. For a complete reference of app IDs and configuration parameters, see the [Vizio SmartCast API App IDs documentation](https://github.com/exiva/Vizio_SmartCast_API#app-ids).

### Development Tools
- **Language**: TypeScript
- **Testing**: Jest
- **Linting**: ESLint
- **Formatting**: Prettier
- **Package Manager**: Yarn

## Application Architecture

### Client-Server Structure
The application follows a monorepo structure with two main packages:
- `packages/client`: React frontend application
- `packages/server`: Node.js backend server

### Data Flow
1. **User Interface**: React components in the client package
2. **API Layer**: GraphQL queries/mutations/subscriptions communicate with the server
3. **Business Logic**: Server processes requests and communicates with the TV
4. **Data Persistence**: PostgreSQL database stores TV settings and authentication tokens

### Key Components
- **Apollo GraphQL Server**: Handles API requests and real-time subscriptions
- **Vizio API Service**: Communicates with the Vizio SmartCast API
- **Prisma ORM**: Manages database operations and schema
- **React Router**: Handles client-side routing
- **Apollo Client**: Manages GraphQL state and caching on the frontend

### Database Model
The application uses a PostgreSQL database with the following schema:
- `TVSettings`: Stores TV configuration including IP address, authentication tokens, and device information

## Development

### Available Scripts

- `yarn dev`: Start development environment (server + client)
- `yarn build`: Build production-ready application
- `yarn test`: Run tests
- `yarn lint`: Run ESLint
- `yarn format`: Format code with Prettier
- `yarn prisma:studio`: Open Prisma Studio to manage database
- `yarn prisma:migrate`: Run database migrations

### Auto-Reload Development Experience

The project is configured for a seamless development experience:

- **Server**: Uses nodemon to automatically restart when server files are changed
- **Client**: Uses Vite with Hot Module Replacement (HMR) to automatically reload browser content when client files are changed

This means you can edit code in real-time and see changes without manually restarting the server or refreshing the browser.

### Database Management

- Edit `packages/server/prisma/schema.prisma` to update the database schema
- Run `yarn prisma:migrate` to apply schema changes
- Use `yarn prisma:studio` to view and edit database records

## Troubleshooting

- **TV Not Connecting**: Ensure your TV is powered on and on the same network
- **Pairing Issues**: Try power cycling your TV and restarting the application
- **Command Failures**: Some commands may not be supported by all Vizio TV models
- **Database Issues**: Check Docker is running and the database connection is working 