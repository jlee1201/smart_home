import { createTestServer } from './test/testServer';
import { parse, subscribe } from 'graphql';
import { TEST_SUBSCRIPTION } from './test/helpers';
import { expectSubscriptionResult } from './test/utils';

describe('Subscriptions', () => {
  it('should receive updates through subscription', async () => {
    const { schema, pubsub } = createTestServer();

    const iterator = await subscribe({
      schema,
      document: parse(TEST_SUBSCRIPTION),
      contextValue: { pubsub },
    });

    if (!iterator || 'errors' in iterator) {
      throw new Error('Failed to create subscription iterator');
    }

    // Trigger an update
    pubsub.publish('INPUT_CHANGED', { inputChanged: 'new value' });

    await expectSubscriptionResult(iterator, {
      inputChanged: 'new value',
    });
  });
}); 