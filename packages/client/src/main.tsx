import './styles.css';
import { createRoot } from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

// Apollo Client setup
const httpLink = new HttpLink({
  uri: '/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: `ws://${window.location.host}/graphql`,
    retryAttempts: 5,
    connectionParams: {
      // Add any connection parameters needed
    },
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  connectToDevTools: true, // Enable Apollo dev tools
});

// Root rendering logic
const renderApp = () => {
  const container = document.getElementById('root');
  if (!container) throw new Error('Failed to find the root element');
  const root = createRoot(container);

  root.render(
    <ApolloProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  );
};

// Initial render
renderApp();

// HMR setup
if (import.meta.hot) {
  import.meta.hot.accept('./App', () => {
    console.log('🔄 HMR update applied for App component');
    renderApp();
  });
}
