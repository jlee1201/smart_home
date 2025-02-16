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

export default function App() {
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
        <Route path="/" element={<HomePage message={data.hello} currentInput={currentInput} />} />
        <Route path="/input" element={<InputPage />} />
      </Routes>
    </div>
  );
} 