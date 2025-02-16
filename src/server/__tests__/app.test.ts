import { schema, root } from '../schema';
import { graphql } from 'graphql';

describe('GraphQL Schema', () => {
  it('should return hello message', async () => {
    const query = '{ hello }';
    const result = await graphql({
      schema,
      source: query,
      rootValue: root,
    });
    expect(result.data?.hello).toBe('Hello from GraphQL!');
  });
});
