import { PubSub } from 'graphql-subscriptions';

export interface Context {
  pubsub: PubSub;
}

export interface UpdateInputArgs {
  value: string;
} 