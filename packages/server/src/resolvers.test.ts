import { createTestServer } from './test/testServer';
import { createOperation, TEST_MUTATION, TEST_QUERY } from './test/helpers';
import { expectValidResult } from './test/utils';

describe('Resolvers', () => {
  const testServer = createTestServer();

  beforeAll(async () => {
    await testServer.server.start();
  });

  afterAll(async () => {
    await testServer.server.stop();
  });

  it('should return hello message', async () => {
    const response = await testServer.executeOperation(`
      query {
        hello
      }
    `);

    expectValidResult(response, {
      hello: 'Hello from GraphQL!',
    });
  });

  it('should update input value', async () => {
    const response = await testServer.executeOperation(
      createOperation(TEST_MUTATION),
      { value: 'test input' }
    );

    expectValidResult(response, {
      updateInput: 'test input',
    });

    // Verify current input was updated
    const currentInputResponse = await testServer.executeOperation(
      createOperation(TEST_QUERY)
    );

    expectValidResult(currentInputResponse, {
      currentInput: 'test input',
    });
  });
}); 