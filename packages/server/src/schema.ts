export const typeDefs = `#graphql
  type Query {
    hello: String
    currentInput: String
    tvStatus: TVStatus
    tvConnectionStatus: TVConnectionStatus
    denonAvrStatus: DenonAVRStatus
    denonAvrConnectionStatus: DenonAVRConnectionStatus
    errorLogs: [ErrorLog]
  }

  type TVStatus {
    isPoweredOn: Boolean
    volume: Int
    channel: String
    isMuted: Boolean
    input: String
    supportedInputs: [String]
  }

  type TVConnectionStatus {
    connected: Boolean
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
    volume: Int
    isMuted: Boolean
    input: String
    soundMode: String
  }

  type DenonAVRConnectionStatus {
    connected: Boolean
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

  type Mutation {
    updateInput(value: String!): String
    sendTVCommand(command: String!, value: String): Boolean
    initiateTVPairing: TVPairingChallenge
    completeTVPairing(pin: String!): TVPairingResult
    resetTVConnection: Boolean
    cancelTVPairing: Boolean
    sendDenonAvrCommand(command: String!, value: String): Boolean
    clearErrorLogs: Boolean
  }

  type Subscription {
    inputChanged: String
    tvStatusChanged: TVStatus
    denonAvrStatusChanged: DenonAVRStatus
    errorLogChanged: [ErrorLog]
    buttonDebugInfo: ButtonDebugInfo
  }
`;
