import { gql, useQuery, useSubscription } from '@apollo/client';
import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { InputPage } from '@/pages/InputPage';

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

export function App() {
  const { loading, error, data } = useQuery(HELLO_QUERY, {
    onError: error => {
      console.error('Query error:', error);
    },
  });

  const { data: subscriptionData, error: subscriptionError } = useSubscription(INPUT_SUBSCRIPTION, {
    onError: error => {
      console.error('Subscription error:', error);
    },
  });

  if (loading) return <div role="status">Loading...</div>;

  if (error) {
    return (
      <div role="alert" className="error-container">
        <h2>Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const currentInput = subscriptionData?.inputChanged || data.currentInput || '';

  return (
    <div className="App">
      <nav>
        <Link to="/">Home</Link> | <Link to="/input">Input Page</Link>
      </nav>

      {subscriptionError && (
        <div role="alert" className="warning-banner">
          Real-time updates unavailable: {subscriptionError.message}
        </div>
      )}

      <Routes>
        <Route path="/" element={<HomePage message={data.hello} currentInput={currentInput} />} />
        <Route path="/input" element={<InputPage />} />
      </Routes>
    </div>
  );
}
