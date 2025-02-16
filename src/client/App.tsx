import { useState, useEffect } from 'react';

interface HelloResponse {
  message: string;
}

function App() {
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data: HelloResponse) => setMessage(data.message));
  }, []);

  return (
    <div className="App">
      <h1>TypeScript React App</h1>
      <p>Message from server: {message}</p>
    </div>
  );
}

export default App; 