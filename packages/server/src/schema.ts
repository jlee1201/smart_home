export const typeDefs = `#graphql
  type Query {
    hello: String
    currentInput: String
    tvStatus: TVStatus
    tvConnectionStatus: TVConnectionStatus
    denonAvrStatus: DenonAVRStatus
    denonAvrConnectionStatus: DenonAVRConnectionStatus
    denonAvrReachable: Boolean!
    errorLogs: [ErrorLog]
  }

  type TVStatus {
    isPoweredOn: Boolean
    volume: Int
    channel: String
    isMuted: Boolean
    input: String
    supportedInputs: [String]
    currentApp: String
    speakersOn: Boolean
  }

  type TVConnectionStatus {
    connected: Boolean
    lastDiscovery: String
    discoveryMethod: String
    responseTime: Int
  }

  type TVPairingResult {
    success: Boolean
    authToken: String
  }

  type TVPairingChallenge {
    challengeCode: String
  }

  type DenonAVRStatus {
    isPoweredOn: Boolean
    volume: Float
    isMuted: Boolean
    input: String
    soundMode: String
  }

  type DenonAVRConnectionStatus {
    connected: Boolean
    lastDiscovery: String
    discoveryMethod: String
    responseTime: Int
  }

  type ErrorLog {
    id: ID!
    timestamp: Float!
    message: String!
    details: String
  }

  type ButtonDebugInfo {
    key: String!
    codeset: String!
    code: String!
  }

  type AppChangeEvent {
    currentApp: String!
    previousApp: String!
    timestamp: String!
    tvStatus: TVStatus!
  }

  type Mutation {
    updateInput(value: String!): String
    sendTVCommand(command: String!, value: String): Boolean
    initiateTVPairing: TVPairingChallenge
    completeTVPairing(pin: String!): TVPairingResult
    resetTVConnection: Boolean
    cancelTVPairing: Boolean
    forceTVRediscovery: Boolean
    sendDenonAvrCommand(command: String!, value: String): Boolean
    clearErrorLogs: Boolean
    syncDevices: Boolean
  }

  type Subscription {
    inputChanged: String
    tvStatusChanged: TVStatus
    denonAvrStatusChanged: DenonAVRStatus
    errorLogChanged: [ErrorLog]
    buttonDebugInfo: ButtonDebugInfo
    appChanged: AppChangeEvent
  }
`;
