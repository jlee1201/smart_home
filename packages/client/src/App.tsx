import { gql, useQuery, useSubscription } from '@apollo/client';
import { Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { InputPage } from '@/pages/InputPage';
import { VizioRemotePage } from '@/pages/VizioRemotePage';
import { TVPairingPage } from '@/pages/TVPairingPage';
import { DenonAvrRemotePage } from '@/pages/DenonAvrRemotePage';
import { Layout } from '@design-system';
import { ErrorLog } from '@/components/ErrorLog';

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

type HelloQuery = {
  hello: string;
  currentInput: string;
};

type InputSubscription = {
  inputChanged: string;
};

export function App() {
  const { loading, error, data } = useQuery<HelloQuery>(HELLO_QUERY, {
    onError: (error) => {
      console.error('Query error:', error);
    },
  });

  const { data: subscriptionData, error: subscriptionError } = useSubscription<InputSubscription>(
    INPUT_SUBSCRIPTION,
    {
      onError: (error) => {
        console.error('Subscription error:', error);
      },
    }
  );

  if (loading) return (
    <div className="flex justify-center items-center" style={{minHeight: '100vh'}}>
      <div className="text-center">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    </div>
  );

  if (error || !data) {
    return (
      <div className="farmhouse-container">
        <div className="farmhouse-error" role="alert">
          <h2>Error</h2>
          <p>{error?.message || 'An unknown error occurred'}</p>
          <button 
            onClick={() => window.location.reload()}
            aria-label="Retry loading the application"
            className="farmhouse-btn farmhouse-btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentInput = subscriptionData?.inputChanged ?? data.currentInput ?? '';

  return (
    <Layout>
      {subscriptionError && (
        <div className="farmhouse-warning mb-4" role="alert">
          Real-time updates unavailable: {subscriptionError.message}
        </div>
      )}

      <Routes>
        <Route 
          path="/" 
          element={<HomePage message={data.hello} currentInput={currentInput} />} 
        />
        <Route path="/input" element={<InputPage />} />
        <Route path="/vizio-remote" element={<VizioRemotePage />} />
        <Route path="/tv-pairing" element={<TVPairingPage />} />
        <Route path="/denon-avr-remote" element={<DenonAvrRemotePage />} />
      </Routes>
      
      {/* Error Log component */}
      <ErrorLog />
    </Layout>
  );
}