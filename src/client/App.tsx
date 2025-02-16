import { useQuery, useSubscription, gql } from '@apollo/client';
import { Link, Routes, Route } from 'react-router-dom';
import { InputPage } from './pages/InputPage';

const HELLO_QUERY = gql`
  query GetHello {
    hello
    currentInput
  }
`;

const INPUT_SUBSCRIPTION = gql`
  subscription OnInputChanged {
    inputChanged
  }
`;

function App() {
  const { loading, error, data } = useQuery(HELLO_QUERY);
  const { data: subscriptionData } = useSubscription(INPUT_SUBSCRIPTION);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const currentInput = subscriptionData?.inputChanged || data.currentInput || '';

  return (
    <div className="App">
      <nav>
        <Link to="/">Home</Link> | <Link to="/input">Input Page</Link>
      </nav>

      <Routes>
        <Route path="/" element={
          <div>
            <h1>TypeScript React App with GraphQL</h1>
            <p>Message from server: {data.hello}</p>
            <p>Current input value: {currentInput}</p>
          </div>
        } />
        <Route path="/input" element={<InputPage />} />
      </Routes>
    </div>
  );
}

export default App; 