import { ExecutionResult } from 'graphql';
import { ApolloServerExecuteOperationResult } from '@apollo/server/dist/esm/externalTypes/graphql';

export function expectValidResult(
  result: ApolloServerExecuteOperationResult,
  expectedData: Record<string, unknown>
) {
  expect(result.body).toMatchObject({
    kind: 'single',
    singleResult: {
      data: expectedData,
    },
  });
}

export async function expectSubscriptionResult(
  iterator: AsyncIterator<ExecutionResult>,
  expectedData: Record<string, unknown>
) {
  const result = await iterator.next();
  expect(result).toEqual({
    value: {
      data: expectedData,
    },
    done: false,
  });
} 