# Smart Home - Vizio TV Control

A web-based remote control application for Vizio SmartCast TVs and Denon AV receivers that provides complete control over your entertainment system from any device on your network.

## Features

- **TV Control**

  - Power on/off with real-time status indication
  - Volume adjustment with visual bar graph display
  - Channel navigation
  - Input selection with active input highlighting
  - Media playback controls (play, pause, stop, etc.)
  - Smart app launching with current app indication
  - Directional navigation
  - Real-time mute status visualization

- **Denon AVR Control**

  - Power on/off with real-time status indication
  - Volume adjustment (raw Denon values 0-99, supports decimals like 62.5) with visual bar graph
  - Input selection with active input highlighting
  - Sound mode control with active mode highlighting
  - Real-time status monitoring via telnet with TCP reachability ping to distinguish network-down vs power-off
  - HTTP fallback for POWER_ON command when telnet is unavailable
  - Real-time mute status visualization

- **John's Remote (Combined Control)**

  - Unified remote combining TV controls with AVR volume
  - TV power control and navigation
  - Smart TV app shortcuts (Netflix, Prime Video, YouTube TV, Disney+) with identical styling to Vizio remote, arranged in space-optimized 2x2 grid layout using inline styles for reliable rendering
  - AVR volume control replacing TV volume
  - One-click "All On" button that:
    - Powers on both TV and Denon AVR if not already on
    - Sets AVR to TV input mode if not already set
    - Sets AVR volume to 55
    - Automatically disables when all devices are on and configured
  - Combined status display showing both TV and AVR states
  - All TV controls except volume and channel controls (navigation, apps, playback, inputs)

- **Device Status Monitoring**: Real-time connection status for all connected devices
- **Smart Home Integration**: Centralized control for multiple entertainment devices
- **Responsive Design**: Works on desktop and mobile devices
- **Persistent Configuration**: Device settings and auth tokens are stored in a database
- **Automatic Device Discovery**: Zero-configuration network discovery for TVs and AVRs that automatically adapts to IP address changes

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

### Device Configuration

The application features **automatic device discovery** that eliminates the need for manual IP configuration. However, you can still provide manual configuration as a fallback or for faster initial connection.

Create a `.env` file in the repository root with:

```
# Server configuration
PORT=8000

# Database configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_home

# Device connection toggles
ENABLE_TV_CONNECTION=true
ENABLE_DENON_AVR_CONNECTION=true

# Optional: Manual device configuration (auto-discovery will be used if omitted)
VIZIO_TV_IP=192.168.1.100     # Optional: Manual TV IP address
VIZIO_TV_PORT=7345           # Optional: TV port (defaults to 7345)
VIZIO_AUTH_TOKEN=            # Will be filled after pairing
VIZIO_DEVICE_NAME="Smart Home Remote"

DENON_AVR_IP=192.168.1.101   # Optional: Manual AVR IP address
DENON_AVR_PORT=23            # Optional: AVR port (defaults to 23)
```

### Automatic Device Discovery

The application includes an intelligent **three-tier discovery system** that automatically finds and connects to your devices:

#### Discovery Priority (TV and AVR)

1. **Database Settings** (Highest Priority): Previously discovered and validated devices
2. **Environment Variables** (Medium Priority): Manual configuration from `.env` file
3. **Network Discovery** (Lowest Priority): Automatic network scanning and validation

#### Network Discovery Process

- **ARP Table Scanning**: Discovers all devices on your local network
- **Device Identification**: Uses hostname patterns, MAC address prefixes, and IP ranges to identify TVs and AVRs
- **Protocol Validation**: Tests actual device communication (HTTP for TVs, Telnet for AVRs)
- **Connection History**: Learns and remembers successful connections for faster future discovery
- **Automatic Reconnection**: Seamlessly handles IP address changes due to DHCP reassignment

#### Discovery Features

- **Zero Configuration**: Works out-of-the-box without any IP address setup
- **Self-Healing**: Automatically adapts when devices change IP addresses
- **Confidence Scoring**: Ranks discovered devices by likelihood of being the correct device
- **Response Time Optimization**: Prioritizes faster-responding devices
- **Manual Override**: Force rediscovery via GraphQL mutation `forceTVRediscovery` or `forceAVRRediscovery`

#### Manual Device Finding (Optional)

If you prefer manual configuration or want to verify device addresses:

- Check your router's DHCP client list
- Use a network scanner like "Fing" app
- Check the network settings on your devices
- Look for devices with "vizio" or "denon" in the hostname

### Running the Application

1. Start the development server:

   ```
   yarn dev
   ```

2. Access the application at `http://localhost:3000`

3. Navigate to "TV Setup" to pair with your TV

4. Follow the on-screen instructions to complete pairing

5. Access John's Remote at `http://localhost:3000/johns-remote` for combined TV and AVR control

## Tech Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **API Client**: Apollo Client
- **UI**: Custom components with React Icons and ToggleButton design system
- **Real-time UI**: Status-aware buttons with visual feedback for device states
- **Build Tool**: Vite

### Backend

- **Runtime**: Node.js
- **Framework**: Express
- **API**: GraphQL with Apollo Server
- **Subscriptions**: GraphQL Subscriptions for real-time updates
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Containerization**: Docker & Docker Compose
- **TV Control**: Custom implementation of the Vizio SmartCast API with HTTPS validation and enhanced power state detection
- **AVR Control**: Custom implementation of the Denon telnet protocol with real-time monitoring
- **Device Discovery**: Intelligent network scanning using ARP table parsing, MAC address recognition, and protocol validation
- **Auto-Recovery**: Self-healing connections that automatically rediscover devices on IP changes
- **Power State Detection**: Multi-layer validation system that accurately determines device power status even when devices respond to API calls in standby mode

### Third-Party Resources

- **Vizio SmartCast API Documentation**: This project's TV control functionality is based on the [Vizio SmartCast API documentation](https://github.com/exiva/Vizio_SmartCast_API).
- **vizio-smart-cast Library**: Implementation references from [heathbar/vizio-smart-cast](https://github.com/heathbar/vizio-smart-cast) JavaScript library.
- **Denon AVR Protocol Documentation**: A comprehensive reference for the Denon network protocol is available in the [docs/denon-protocol.pdf](docs/denon-protocol.pdf) file.

### Real-Time Status Visualization

Both the Vizio TV and Denon AVR remotes feature comprehensive real-time status visualization:

#### Visual Feedback System

- **Power Status**: Green highlighting when devices are powered on
- **Mute Status**: Terracotta highlighting when audio is muted
- **Active Inputs**: Blue highlighting for currently selected inputs
- **Active Apps**: Blue highlighting for currently running smart TV apps
- **Volume Visualization**: Animated bar graph showing current volume levels
  - Blue bars for normal volume
  - Terracotta bars when muted
  - Real-time updates as volume changes

#### ToggleButton Design System

The application uses a custom `ToggleButton` component with multiple variants:

- `power`: For power on/off controls with farmhouse-green active state
- `mute`: For mute controls with farmhouse-terracotta active state
- `input`: For input/app selection with farmhouse-blue active state
- `sound-mode`: For sound mode selection with farmhouse-brown active state

### Volume Control Formats

The application uses different volume formats for different devices:

- **Vizio TV**: Volume is represented as a percentage (0-100)
- **Denon AVR**: Volume uses raw Denon values (0-99) with decimal precision support (e.g., 62.5)
  - This provides more precise volume control matching the AVR's native format
  - Real-time volume changes are detected and updated automatically via telnet monitoring

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
3. **Business Logic**: Server processes requests and communicates with connected devices
4. **Data Persistence**: PostgreSQL database stores device settings and authentication tokens

### Key Components

- **Apollo GraphQL Server**: Handles API requests and real-time subscriptions
- **Vizio API Service**: Communicates with the Vizio SmartCast API
- **Denon AVR Service**: Communicates with Denon AV receivers via telnet protocol
- **John's Remote**: Combined control interface with "All On" functionality
- **All On Mutation**: GraphQL mutation that intelligently powers on and configures multiple devices
- **Prisma ORM**: Manages database operations and schema
- **React Router**: Handles client-side routing
- **Apollo Client**: Manages GraphQL state and caching on the frontend

### Database Model

The application uses a PostgreSQL database with the following schema:

- `TVSettings`: Stores TV configuration including IP address, authentication tokens, device information, discovery history, and connection tracking
- `AVRSettings`: Stores Denon AVR configuration, connection details, discovery history, and MAC address identification

#### Discovery Enhancement Fields

- **Connection History**: Tracks successful and failed connection attempts
- **Discovery Timestamps**: Records when devices were last found and validated
- **MAC Address Storage**: Enables device identification across IP changes
- **Confidence Scoring**: Stores device identification confidence levels
- **Response Time Tracking**: Optimizes connection attempts based on device performance

## Development

### Available Scripts

- `yarn dev`: Start development environment (server + client)
- `yarn build`: Build production-ready application
- `yarn test`: Run tests
- `yarn lint`: Run ESLint
- `yarn format`: Format code with Prettier
- `yarn prisma:studio`: Open Prisma Studio to manage database
- `yarn prisma:migrate`: Run database migrations

### Discovery and Testing Scripts

- `node test_tv_discovery.mjs`: Test TV network discovery and validation
- GraphQL Mutations for manual discovery control:
  - `forceTVRediscovery`: Force immediate TV rediscovery
  - `forceAVRRediscovery`: Force immediate AVR rediscovery

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

### Connection Issues

- **Device Not Found**: Ensure devices are powered on and connected to the same network
- **IP Address Changes**: The automatic discovery system should handle this, but you can force rediscovery via GraphQL mutations
- **Slow Discovery**: Initial network scanning may take 5-10 seconds; subsequent connections use cached results

### TV-Specific Issues

- **TV Not Connecting**: Ensure your TV is powered on and SmartCast is enabled
- **Pairing Issues**: Try power cycling your TV and restarting the application
- **Command Failures**: Some commands may not be supported by all Vizio TV models
- **Incorrect Power Status**: The system now uses enhanced power state detection with multiple verification checks to accurately determine if the TV is actually on or in standby mode

### AVR-Specific Issues

- **AVR Not Responding**: Check that network control is enabled in AVR settings
- **Telnet Connection Failed**: Verify the AVR is powered on and telnet port 23 is accessible

### Discovery Troubleshooting

- **No Devices Found**: Run `node test_tv_discovery.mjs` to test the discovery system
- **Wrong Device Detected**: Check MAC address patterns in the discovery logs
- **Force Rediscovery**: Use GraphQL mutations `forceTVRediscovery` or `forceAVRRediscovery`

### General Issues

- **Database Issues**: Check Docker is running and the database connection is working
- **Network Permissions**: Ensure the application has permission to scan the local network
