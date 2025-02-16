import { createIntegrationServer } from './test/integrationServer';
import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';

describe('Error Handling', () => {
  let testEnv: Awaited<ReturnType<typeof createIntegrationServer>>;
  let client: ApolloClient<any>;

  beforeAll(async () => {
    testEnv = await createIntegrationServer();

    client = new ApolloClient({
      link: new HttpLink({
        uri: `${testEnv.url}/graphql`,
      }),
      cache: new InMemoryCache(),
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('should handle invalid queries', async () => {
    const invalidQuery = gql`
      query {
        nonExistentField
      }
    `;

    try {
      await client.query({
        query: invalidQuery,
      });
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('Cannot query field "nonExistentField"');
    }
  });

  it('should handle mutation with invalid input', async () => {
    const invalidMutation = gql`
      mutation {
        updateInput
      }
    `;

    try {
      await client.mutate({
        mutation: invalidMutation,
      });
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('Field "updateInput" argument "value" of type "String!" is required');
    }
  });
}); 