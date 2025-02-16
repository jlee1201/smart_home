import { useQuery, gql } from '@apollo/client';

const HELLO_QUERY = gql`
  query GetHello {
    hello
  }
`;

function App() {
  const { loading, error, data } = useQuery(HELLO_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="App">
      <h1>TypeScript React App with GraphQL</h1>
      <p>Message from server: {data.hello}</p>
    </div>
  );
}

export default App; 