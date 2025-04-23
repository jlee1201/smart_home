import { gql, useMutation } from '@apollo/client';
import { ChangeEvent, useState, useCallback, useEffect } from 'react';
import debounce from 'lodash/debounce';

const UPDATE_INPUT = gql`
  mutation UpdateInput($value: String!) {
    updateInput(value: $value)
  }
`;

type UpdateInputMutation = {
  updateInput: string;
};

type UpdateInputVariables = {
  value: string;
};

export function InputPage() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [updateInput, { loading }] = useMutation<UpdateInputMutation, UpdateInputVariables>(
    UPDATE_INPUT,
    {
      onError: (error) => {
        setError(error.message);
      },
    }
  );

  // Debounce the mutation to prevent too many requests
  const debouncedUpdate = useCallback(
    debounce(async (value: string) => {
      try {
        await updateInput({
          variables: { value },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        setError(message);
        console.error('Input update failed:', error);
      }
    }, 300),
    [updateInput]
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);
    debouncedUpdate(value);
  };

  return (
    <div className="InputPage">
      <h1>Input Page</h1>
      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type something..."
          aria-invalid={!!error}
          aria-describedby={error ? "error-message" : undefined}
          disabled={loading}
        />
        {loading && (
          <div className="input-status" aria-live="polite">
            Updating...
          </div>
        )}
        {error && (
          <div 
            id="error-message"
            className="error-message" 
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
