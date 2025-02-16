import { gql, useMutation } from '@apollo/client';
import { ChangeEvent, useState } from 'react';

const UPDATE_INPUT = gql`
  mutation UpdateInput($value: String!) {
    updateInput(value: $value)
  }
`;

export function InputPage() {
  const [inputValue, setInputValue] = useState('');
  const [updateInput] = useMutation(UPDATE_INPUT);

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    await updateInput({ variables: { value } });
  };

  return (
    <div className="InputPage">
      <h1>Input Page</h1>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Type something..."
      />
    </div>
  );
} 