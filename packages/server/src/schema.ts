export const typeDefs = `#graphql
  type Query {
    hello: String
    currentInput: String
  }

  type Mutation {
    updateInput(value: String!): String
  }

  type Subscription {
    inputChanged: String
  }
`; 