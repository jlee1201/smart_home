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

const RESET_TV_CONNECTION_MUTATION = gql`
  mutation ResetTVConnection {
    resetTVConnection
  }
`;

const CANCEL_TV_PAIRING_MUTATION = gql`
  mutation CancelTVPairing {
    cancelTVPairing
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
      const code = data.initiateTVPairing.challengeCode;
      
      if (code) {
        setChallengeCode(code === "PIN_ON_SCREEN" ? 
          "The PIN is displayed on your TV screen" : 
          code);
        setPairingInProgress(true);
        setErrorMessage('');
      }
    },
    onError: (error) => {
      // If we have an error but the PIN is actually displayed on TV, 
      // let's continue anyway
      setPairingInProgress(true);
      setChallengeCode("Enter the PIN shown on your TV screen");
      setErrorMessage(`Error: ${error.message}. If you see a PIN on your TV, please enter it anyway.`);
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
      // Check if this is a PIN rejection error
      if (error.message.includes('Invalid PIN') || 
          error.message.includes('INVALID_PIN') || 
          error.message.includes('PIN entered was incorrect')) {
        setErrorMessage(`Failed to pair: The PIN was rejected by your TV. Please make sure you entered the correct PIN shown on your TV screen.`);
        // Keep the pairing UI open so they can try again
      } else if (error.message.includes('INVALID_PARAMETER') || 
                error.message.includes('pairing session expired') || 
                error.message.includes('restart the pairing')) {
        setErrorMessage(`The pairing session has expired or is invalid. Please close this dialog and click "Start Pairing" again.`);
        // Keep the error visible but close the PIN entry form
        setPairingInProgress(false);
      } else {
        setErrorMessage(`Failed to complete pairing: ${error.message}`);
      }
    }
  });
  
  const [resetTVConnection, { loading: resetLoading }] = useMutation(RESET_TV_CONNECTION_MUTATION, {
    onCompleted: () => {
      setSuccessMessage('TV connection reset. You can now pair again.');
      refetchConnection();
    },
    onError: (error) => {
      setErrorMessage(`Failed to reset TV connection: ${error.message}`);
    }
  });
  
  const [cancelTVPairing, { loading: cancelLoading }] = useMutation(CANCEL_TV_PAIRING_MUTATION, {
    onCompleted: () => {
      setSuccessMessage('Any existing pairing requests have been canceled. You can now start a new pairing process.');
    },
    onError: (error) => {
      setErrorMessage(`Failed to cancel pairing: ${error.message}`);
    }
  });
  
  const handleInitiatePairing = () => {
    setSuccessMessage('');
    setErrorMessage('');
    setPairingInProgress(false); // Reset pairing status to start fresh
    initiatePairing();
  };
  
  const handleResetTVConnection = () => {
    setSuccessMessage('');
    setErrorMessage('');
    resetTVConnection();
  };
  
  const handleCancelTVPairing = () => {
    setSuccessMessage('');
    setErrorMessage('');
    cancelTVPairing();
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
  const loading = connectionLoading || initiateLoading || completeLoading || resetLoading || cancelLoading;
  
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
              
              {isConnected && (
                <div className="mt-4">
                  <div className="flex gap-4 mb-2">
                    <Button 
                      variant="secondary"
                      onClick={handleInitiatePairing}
                      disabled={loading}
                    >
                      Force Re-pair TV
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={handleResetTVConnection}
                      disabled={loading}
                    >
                      Reset Connection
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    If the remote isn't working, try "Reset Connection" first. If that doesn't work, 
                    use "Force Re-pair TV" to start a new pairing session without rebooting your TV.
                  </p>
                </div>
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
                  <p className="text-sm mt-2">Note: You must enter the PIN within 60 seconds before the pairing session expires.</p>
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
                    setPin('');
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