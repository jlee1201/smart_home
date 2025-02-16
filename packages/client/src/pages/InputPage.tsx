import { gql, useMutation } from '@apollo/client';
import { ChangeEvent, useState } from 'react';

const UPDATE_INPUT = gql`
  mutation UpdateInput($value: String!) {
    updateInput(value: $value)
  }
`;

export function InputPage() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updateInput] = useMutation(UPDATE_INPUT, {
    onError: error => {
      setError(error.message);
    },
  });

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);

    try {
      await updateInput({
        variables: { value },
        onError: error => {
          setError(error.message);
        },
      });
    } catch (error) {
      // Handle any synchronous errors
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  };

  return (
    <div className="InputPage">
      <h1>Input Page</h1>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Type something..."
        aria-invalid={!!error}
      />
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
