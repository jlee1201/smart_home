import { useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Button, Card, Input } from '@design-system';

const TV_CONNECTION_STATUS_QUERY = gql`
  query GetTVConnectionStatus {
    tvConnectionStatus {
      connected
    }
  }
`;

const INITIATE_PAIRING_MUTATION = gql`
  mutation InitiateTVPairing {
    initiateTVPairing {
      challengeCode
    }
  }
`;

const COMPLETE_PAIRING_MUTATION = gql`
  mutation CompleteTVPairing($pin: String!) {
    completeTVPairing(pin: $pin) {
      success
      authToken
    }
  }
`;

export function TVPairingPage() {
  const [pin, setPin] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [pairingInProgress, setPairingInProgress] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Query connection status
  const { data: connectionData, loading: connectionLoading, refetch: refetchConnection } = useQuery(TV_CONNECTION_STATUS_QUERY);
  
  // Mutations
  const [initiatePairing, { loading: initiateLoading }] = useMutation(INITIATE_PAIRING_MUTATION, {
    onCompleted: (data) => {
      if (data.initiateTVPairing.challengeCode) {
        setChallengeCode(data.initiateTVPairing.challengeCode);
        setPairingInProgress(true);
        setErrorMessage('');
      }
    },
    onError: (error) => {
      setErrorMessage(`Failed to initiate pairing: ${error.message}`);
    }
  });
  
  const [completePairing, { loading: completeLoading }] = useMutation(COMPLETE_PAIRING_MUTATION, {
    onCompleted: (data) => {
      if (data.completeTVPairing.success) {
        setPairingInProgress(false);
        setChallengeCode('');
        setPin('');
        setSuccessMessage('TV paired successfully! You can now use the remote');
        setErrorMessage('');
        refetchConnection();
      }
    },
    onError: (error) => {
      setErrorMessage(`Failed to complete pairing: ${error.message}`);
    }
  });
  
  const handleInitiatePairing = () => {
    setSuccessMessage('');
    setErrorMessage('');
    initiatePairing();
  };
  
  const handleCompletePairing = () => {
    if (!pin.trim()) {
      setErrorMessage('Please enter the PIN displayed on your TV');
      return;
    }
    
    setSuccessMessage('');
    setErrorMessage('');
    completePairing({
      variables: { pin: pin.trim() }
    });
  };
  
  const isConnected = connectionData?.tvConnectionStatus?.connected === true;
  const loading = connectionLoading || initiateLoading || completeLoading;
  
  return (
    <div>
      <h2>Vizio TV Pairing</h2>
      
      <div className="grid grid-cols-1 gap-8 mt-6">
        <Card title="Connection Status" subtitle="Current TV connection status">
          {connectionLoading ? (
            <p>Loading connection status...</p>
          ) : (
            <div>
              <p className="mb-4">
                TV Status: <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </p>
              
              {isConnected && (
                <p className="text-green-600">
                  Your TV is connected and ready to use. You can access the remote control from the TV Remote page.
                </p>
              )}
            </div>
          )}
        </Card>
        
        {!isConnected && (
          <Card title="Pair with TV" subtitle="Connect to your Vizio TV">
            {successMessage && (
              <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
                {successMessage}
              </div>
            )}
            
            {errorMessage && (
              <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
                {errorMessage}
              </div>
            )}
            
            {!pairingInProgress ? (
              <div>
                <p className="mb-4">To control your Vizio TV, you need to pair this app with your TV. Make sure your TV is powered on and connected to the same network.</p>
                
                <Button 
                  onClick={handleInitiatePairing}
                  disabled={loading}
                >
                  Start Pairing
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded">
                  <p className="font-bold mb-2">Please look at your TV screen</p>
                  <p>A pairing code should appear on your TV. Enter it below to complete the pairing process.</p>
                </div>
                
                <div className="mb-4">
                  <p className="mb-2">Challenge code: <strong>{challengeCode}</strong></p>
                  <p>Enter the PIN displayed on your TV:</p>
                  <div className="flex items-end gap-2 mt-2">
                    <div className="flex-grow">
                      <Input
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Enter PIN"
                        disabled={loading}
                      />
                    </div>
                    <Button 
                      onClick={handleCompletePairing}
                      disabled={loading || !pin.trim()}
                    >
                      Pair
                    </Button>
                  </div>
                </div>
                
                <Button 
                  variant="text"
                  onClick={() => {
                    setPairingInProgress(false);
                    setChallengeCode('');
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
} 