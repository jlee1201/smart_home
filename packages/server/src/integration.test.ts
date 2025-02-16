import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { createIntegrationServer } from './test/integrationServer';
import { TEST_MUTATION, TEST_QUERY, TEST_SUBSCRIPTION } from './test/helpers';

describe('Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createIntegrationServer>>;
  let client: ApolloClient<any>;

  beforeAll(async () => {
    testEnv = await createIntegrationServer();

    const httpLink = new HttpLink({
      uri: `${testEnv.url}/graphql`,
    });

    const wsLink = new GraphQLWsLink(
      createClient({
        url: `${testEnv.wsUrl}/graphql`,
      })
    );

    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      httpLink
    );

    client = new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('should handle query, mutation, and subscription', async () => {
    // Set up subscription first
    const subscriptionPromise = new Promise(resolve => {
      const subscription = client
        .subscribe({
          query: TEST_SUBSCRIPTION,
        })
        .subscribe({
          next: ({ data }) => {
            subscription.unsubscribe();
            resolve(data);
          },
        });
    });

    // Perform mutation
    const mutationResult = await client.mutate({
      mutation: TEST_MUTATION,
      variables: { value: 'integration test' },
    });

    expect(mutationResult.data).toEqual({
      updateInput: 'integration test',
    });

    // Check query result
    const queryResult = await client.query({
      query: TEST_QUERY,
    });

    expect(queryResult.data).toEqual({
      currentInput: 'integration test',
    });

    // Wait for subscription result
    const subscriptionResult = await subscriptionPromise;
    expect(subscriptionResult).toEqual({
      inputChanged: 'integration test',
    });
  });
});
