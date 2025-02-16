import { DocumentNode, print } from 'graphql';
import { gql } from 'graphql-tag';

export function createOperation(query: string | DocumentNode) {
  if (typeof query === 'string') {
    return query;
  }
  return print(query);
}

export const TEST_SUBSCRIPTION = gql`
  subscription OnInputChanged {
    inputChanged
  }
`;

export const TEST_MUTATION = gql`
  mutation UpdateInput($value: String!) {
    updateInput(value: $value)
  }
`;

export const TEST_QUERY = gql`
  query GetCurrentInput {
    currentInput
  }
`;
