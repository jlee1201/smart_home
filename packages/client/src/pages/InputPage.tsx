import { gql, useMutation } from '@apollo/client';
import { ChangeEvent, useState, useCallback, useEffect } from 'react';
import debounce from 'lodash/debounce';
import { Card, Input, Button } from '@design-system';

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

  const handleClear = () => {
    setInputValue('');
    setError(null);
    debouncedUpdate('');
  };

  return (
    <div>
      <h2>Control Your Smart Home</h2>
      
      <Card 
        title="Input Controls"
        subtitle="Update values in real-time"
        className="max-w-lg mt-6"
      >
        <p>
          Enter a value below to update it in real-time across all connected clients.
        </p>
        
        <Input
          label="Smart Home Command"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type something..."
          error={error || undefined}
          disabled={loading}
          helperText="Commands are processed in real-time"
          fullWidth
        />
        
        <div className="flex gap-4 pt-2">
          <Button
            variant="primary"
            disabled={!inputValue || loading}
            onClick={() => debouncedUpdate(inputValue)}
          >
            {loading ? 'Updating...' : 'Update'}
          </Button>
          
          <Button
            variant="secondary"
            disabled={!inputValue || loading}
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      </Card>
    </div>
  );
}
