import { buildSchema } from 'graphql';

export const schema = buildSchema(`
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
`);

let currentInput = '';
let subscribers: Array<(value: string) => void> = [];

export const root = {
  hello: () => 'Hello from GraphQL!',
  currentInput: () => currentInput,
  updateInput: ({ value }: { value: string }) => {
    currentInput = value;
    subscribers.forEach(fn => fn(value));
    return value;
  },
  inputChanged: {
    subscribe: (_: any, __: any, { pubsub }: any) => {
      return pubsub.asyncIterator('INPUT_CHANGED');
    },
  },
};

export const publishInputChange = (value: string) => {
  subscribers.forEach(fn => fn(value));
}; 