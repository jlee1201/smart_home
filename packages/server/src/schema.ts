export const typeDefs = `#graphql
  type Query {
    hello: String
    currentInput: String
    tvStatus: TVStatus
    tvConnectionStatus: TVConnectionStatus
  }

  type TVStatus {
    isPoweredOn: Boolean
    volume: Int
    channel: String
    isMuted: Boolean
    input: String
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

  type Mutation {
    updateInput(value: String!): String
    sendTVCommand(command: String!, value: String): Boolean
    initiateTVPairing: TVPairingChallenge
    completeTVPairing(pin: String!): TVPairingResult
  }

  type Subscription {
    inputChanged: String
    tvStatusChanged: TVStatus
  }
`;
