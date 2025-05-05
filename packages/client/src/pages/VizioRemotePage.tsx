import { useState, useEffect } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { Button, Card, Input } from '@design-system';
import { Link } from 'react-router-dom';

// HMR test comment - this should update without a full page reload
console.log('VizioRemotePage updated - HMR test', new Date().toISOString());

const TV_STATUS_QUERY = gql`
  query GetTVStatus {
    tvStatus {
      isPoweredOn
      volume
      channel
      isMuted
      input
    }
    tvConnectionStatus {
      connected
    }
  }
`;

const TV_STATUS_SUBSCRIPTION = gql`
  subscription OnTVStatusChanged {
    tvStatusChanged {
      isPoweredOn
      volume
      channel
      isMuted
      input
    }
  }
`;

const SEND_TV_COMMAND = gql`
  mutation SendTVCommand($command: String!, $value: String) {
    sendTVCommand(command: $command, value: $value)
  }
`;

const ERROR_LOGS_SUBSCRIPTION = gql`
  subscription OnErrorLogChanged {
    errorLogChanged {
      id
      timestamp
      message
      details
    }
  }
`;

type TVStatus = {
  isPoweredOn: boolean;
  volume: number;
  channel: string;
  isMuted: boolean;
  input: string;
};

type ErrorLog = {
  id: string;
  timestamp: number;
  message: string;
  details?: string;
};

export function VizioRemotePage() {
  const [volume, setVolume] = useState(50);
  const [channel, setChannel] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [currentInput, setCurrentInput] = useState('HDMI_1');
  
  // Query initial TV status
  const { loading: queryLoading, data: queryData, error: queryError, refetch: refetchStatus } = useQuery<{ 
    tvStatus: TVStatus; 
    tvConnectionStatus: { connected: boolean } 
  }>(TV_STATUS_QUERY, {
    onCompleted: (data) => {
      if (data.tvStatus) {
        setIsPoweredOn(data.tvStatus.isPoweredOn);
        setVolume(data.tvStatus.volume);
        setChannel(data.tvStatus.channel);
        setIsMuted(data.tvStatus.isMuted);
        setCurrentInput(data.tvStatus.input);
      }
    },
    onError: (error) => {
      console.error('Error fetching TV status:', error);
    },
    // Poll every 5 seconds to detect connection changes
    pollInterval: 5000,
    fetchPolicy: 'network-only' // Don't use cache for status updates
  });
  
  // Subscribe to TV status changes
  const { data: subscriptionData } = useSubscription<{ tvStatusChanged: TVStatus }>(TV_STATUS_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.tvStatusChanged) {
        const status = data.data.tvStatusChanged;
        setIsPoweredOn(status.isPoweredOn);
        setVolume(status.volume);
        setChannel(status.channel);
        setIsMuted(status.isMuted);
        setCurrentInput(status.input);
      }
    },
    onError: (error) => {
      console.error('Subscription error:', error);
    }
  });
  
  // Subscribe to error logs
  const { data: errorLogData } = useSubscription<{ errorLogChanged: ErrorLog[] }>(ERROR_LOGS_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.errorLogChanged && data.data.errorLogChanged.length > 0) {
        // Get the most recent error
        const latestError = data.data.errorLogChanged[0];
        // Only show TV remote related errors (filter by message content)
        if (latestError.message.includes('TV') || latestError.message.includes('remote')) {
          setErrorMessage(latestError.message);
          
          // Clear error message after 5 seconds
          setTimeout(() => {
            setErrorMessage('');
          }, 5000);
        }
      }
    },
    onError: (error) => {
      console.error('Error log subscription error:', error);
    }
  });
  
  // Use effect to update state from subscription
  useEffect(() => {
    if (subscriptionData?.tvStatusChanged) {
      const status = subscriptionData.tvStatusChanged;
      setIsPoweredOn(status.isPoweredOn);
      setVolume(status.volume);
      setChannel(status.channel);
      setIsMuted(status.isMuted);
      setCurrentInput(status.input);
    }
  }, [subscriptionData]);
  
  const [sendCommand, { loading: commandLoading, error: commandError }] = useMutation(SEND_TV_COMMAND, {
    onError: (error) => {
      console.error('Error sending command:', error);
      setErrorMessage('Failed to send command to TV. The connection may have been lost.');
      refetchStatus();
    }
  });
  
  // Add a state for the error message
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Add effect to check connection status and redirect if disconnected
  useEffect(() => {
    // If we have data and TV is not connected, redirect to the pairing page
    if (queryData && !queryData.tvConnectionStatus.connected) {
      setErrorMessage('TV connection lost. Please set up your TV again.');
      // Add a small delay before redirecting
      const redirectTimer = setTimeout(() => {
        window.location.href = '/tv-pairing';
      }, 3000);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [queryData]);
  
  // Add effect to refetch status if there's an error
  useEffect(() => {
    if (queryError) {
      setErrorMessage('Error communicating with TV. Will attempt to reconnect...');
      // Try to refetch after a delay
      const refetchTimer = setTimeout(() => {
        refetchStatus();
      }, 5000);
      
      return () => clearTimeout(refetchTimer);
    }
  }, [queryError, refetchStatus]);
  
  // Add effect to show command errors
  useEffect(() => {
    if (commandError) {
      setErrorMessage(`Command error: ${commandError.message}`);
    }
  }, [commandError]);
  
  const handleCommand = async (command: string, value?: string) => {
    try {
      // Only clear error message for new commands, not from existing errors
      if (!commandError && !errorMessage.includes('Failed')) {
        setErrorMessage(''); 
      }
      
      const result = await sendCommand({ variables: { command, value } });
      
      // Check if the command failed (returned false)
      if (result.data && result.data.sendTVCommand === false) {
        setErrorMessage(`The command "${command}" failed. The TV may be unresponsive.`);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      setErrorMessage('Failed to send command to TV. The connection may have been lost.');
      // Also try to refetch the status to see if we're still connected
      refetchStatus();
    }
  };

  const isTVConnected = queryData?.tvConnectionStatus?.connected === true;
  const loading = queryLoading || commandLoading;
  
  if (!isTVConnected) {
    return (
      <div>
        <h2>Vizio TV Remote Control</h2>
        
        <div className="grid grid-cols-1 gap-8 mt-6">
          <Card title="TV Not Connected" subtitle="Connection required">
            <p className="mb-4">
              Your TV is not connected. You need to pair with your Vizio TV before you can control it.
            </p>
            <Link to="/tv-pairing" className="farmhouse-btn farmhouse-btn-primary">
              Go to TV Setup
            </Link>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h2>Vizio TV Remote Control</h2>
      
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-8 mt-6">
        <Card title="Status" subtitle="Current TV status">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Power:</strong> {isPoweredOn ? 'On' : 'Off'}
            </div>
            <div>
              <strong>Input:</strong> {currentInput.replace('_', ' ')}
            </div>
            <div>
              <strong>Volume:</strong> {volume}% {isMuted ? '(Muted)' : ''}
            </div>
            <div>
              <strong>Channel:</strong> {channel || 'N/A'}
            </div>
          </div>
        </Card>
        
        <Card title="Power & Input" subtitle="Control power and input source">
          <div className="flex flex-wrap gap-4">
            <Button 
              variant={isPoweredOn ? "secondary" : "primary"}
              onClick={() => handleCommand('POWER')}
              disabled={loading}
            >
              {isPoweredOn ? 'Turn Off' : 'Turn On'}
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_HDMI_1')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'HDMI_1' ? 'primary' : 'secondary'}
            >
              HDMI 1
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_HDMI_2')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'HDMI_2' ? 'primary' : 'secondary'}
            >
              HDMI 2
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_TV')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'TV' ? 'primary' : 'secondary'}
            >
              TV
            </Button>
          </div>
        </Card>
        
        <Card title="Volume Control" subtitle="Adjust volume and mute">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <span>Volume: {volume}%</span>
              {isMuted && <span className="ml-2 text-red-500">(Muted)</span>}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${volume}%` }}></div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleCommand('VOLUME_UP')} disabled={loading || !isPoweredOn}>
              Volume +
            </Button>
            
            <Button onClick={() => handleCommand('VOLUME_DOWN')} disabled={loading || !isPoweredOn}>
              Volume -
            </Button>
            
            <Button 
              variant={isMuted ? "primary" : "secondary"}
              onClick={() => handleCommand('MUTE')}
              disabled={loading || !isPoweredOn}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
        </Card>
        
        <Card title="Channel Control" subtitle="Navigation and channel selection">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Button onClick={() => handleCommand('UP')} disabled={loading || !isPoweredOn}>
              ▲
            </Button>
            <div></div>
            <div></div>
            
            <Button onClick={() => handleCommand('LEFT')} disabled={loading || !isPoweredOn}>
              ◀
            </Button>
            <Button onClick={() => handleCommand('OK')} disabled={loading || !isPoweredOn}>
              OK
            </Button>
            <Button onClick={() => handleCommand('RIGHT')} disabled={loading || !isPoweredOn}>
              ▶
            </Button>
            
            <div></div>
            <Button onClick={() => handleCommand('DOWN')} disabled={loading || !isPoweredOn}>
              ▼
            </Button>
            <div></div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <Button onClick={() => handleCommand('CHANNEL_UP')} disabled={loading || !isPoweredOn}>
              Channel +
            </Button>
            
            <Button onClick={() => handleCommand('CHANNEL_DOWN')} disabled={loading || !isPoweredOn}>
              Channel -
            </Button>
            
            <Button onClick={() => handleCommand('GUIDE')} disabled={loading || !isPoweredOn}>
              Guide
            </Button>
            
            <Button onClick={() => handleCommand('INFO')} disabled={loading || !isPoweredOn}>
              Info
            </Button>
          </div>
          
          <div className="flex items-end gap-2">
            <div className="flex-grow">
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Enter channel number"
                disabled={!isPoweredOn}
              />
            </div>
            <Button 
              onClick={() => handleCommand('CHANNEL', channel)}
              disabled={loading || !channel || !isPoweredOn}
            >
              Go
            </Button>
          </div>
        </Card>
        
        <Card title="Playback Controls" subtitle="Media controls">
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleCommand('PLAY')} disabled={loading || !isPoweredOn}>
              ▶ Play
            </Button>
            
            <Button onClick={() => handleCommand('PAUSE')} disabled={loading || !isPoweredOn}>
              ⏸ Pause
            </Button>
            
            <Button onClick={() => handleCommand('STOP')} disabled={loading || !isPoweredOn}>
              ⏹ Stop
            </Button>
            
            <Button onClick={() => handleCommand('REWIND')} disabled={loading || !isPoweredOn}>
              ⏪ Rewind
            </Button>
            
            <Button onClick={() => handleCommand('FAST_FORWARD')} disabled={loading || !isPoweredOn}>
              ⏩ Forward
            </Button>
          </div>
        </Card>
        
        <Card title="Smart Features" subtitle="Apps and smart TV features">
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleCommand('HOME')} disabled={loading || !isPoweredOn}>
              Home
            </Button>
            
            <Button onClick={() => handleCommand('MENU')} disabled={loading || !isPoweredOn}>
              Menu
            </Button>
            
            <Button onClick={() => handleCommand('BACK')} disabled={loading || !isPoweredOn}>
              Back
            </Button>
            
            <Button onClick={() => handleCommand('EXIT')} disabled={loading || !isPoweredOn}>
              Exit
            </Button>
            
            <Button onClick={() => handleCommand('APP_NETFLIX')} disabled={loading || !isPoweredOn}>
              Netflix
            </Button>
            
            <Button onClick={() => handleCommand('APP_YOUTUBE')} disabled={loading || !isPoweredOn}>
              YouTube
            </Button>
            
            <Button onClick={() => handleCommand('APP_PRIME')} disabled={loading || !isPoweredOn}>
              Prime Video
            </Button>
            
            <Button onClick={() => handleCommand('APP_DISNEY')} disabled={loading || !isPoweredOn}>
              Disney+
            </Button>
          </div>
        </Card>
        
        <Card title="Number Pad" subtitle="Direct channel input">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
              <Button 
                key={num} 
                onClick={() => handleCommand('NUMBER', num.toString())}
                disabled={loading || !isPoweredOn}
              >
                {num}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
} 