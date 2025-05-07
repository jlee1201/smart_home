import { useState, useEffect } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { Button, Card, Input } from '@design-system';
import { Link } from 'react-router-dom';
import { FaPowerOff, FaVolumeUp, FaVolumeDown, FaVolumeMute, FaVolumeOff, FaExchangeAlt, FaArrowLeft, 
         FaHome, FaBars, FaInfoCircle, FaBackspace, FaList, FaFastBackward, FaPlay, FaPause, FaStop, 
         FaFastForward } from 'react-icons/fa';

// HMR test comment - this should update without a full page reload
console.log('VizioRemotePage updated - HMR test', new Date().toISOString());

// Define a GQL subscription to listen for button press information
const BUTTON_DEBUG_SUBSCRIPTION = gql`
  subscription OnButtonDebugInfo {
    buttonDebugInfo {
      key
      codeset
      code
    }
  }
`;

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
  
  // Subscribe to button debug information
  useSubscription(BUTTON_DEBUG_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.buttonDebugInfo) {
        const { key, codeset, code } = data.data.buttonDebugInfo;
        console.log(`Button Debug: key=${key}, codeset=${codeset}, code=${code}`);
      }
    },
    onError: (error) => {
      console.error('Button debug subscription error:', error);
    }
  });
  
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
      
      <div className="flex justify-center mt-6">
        <div className="relative w-full max-w-sm bg-slate-900 rounded-3xl px-6 pt-6 pb-10 shadow-xl">
          {/* Vizio logo at top */}
          <div className="text-center mb-4">
            <div className="text-white font-bold text-2xl tracking-wider">VIZIO</div>
          </div>
          
          {/* TV Status Display - Like a remote screen */}
          <div className="bg-slate-300 rounded-lg p-3 mb-6 text-center shadow-inner">
            <div className="font-bold text-lg mb-1">
              {isPoweredOn ? 'TV ON' : 'TV OFF'}
            </div>
            <div className="text-sm">
              <div><strong>Input:</strong> {currentInput.replace('_', ' ')}</div>
              <div><strong>Volume:</strong> {volume}% {isMuted ? '(Muted)' : ''}</div>
              {channel && <div><strong>Channel:</strong> {channel}</div>}
            </div>
          </div>
          
          {/* Power & Input Row */}
          <div className="flex justify-between mb-6">
            <Button 
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-md"
              onClick={() => handleCommand('POWER')}
              disabled={loading}
              title="Turn TV On/Off"
            >
              <FaPowerOff />
            </Button>
            
            <Button 
              className="px-4 py-2 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md self-center"
              onClick={() => {
                // Toggle through inputs
                if (currentInput === 'HDMI_1') handleCommand('INPUT_HDMI_2');
                else if (currentInput === 'HDMI_2') handleCommand('INPUT_TV');
                else handleCommand('INPUT_HDMI_1');
              }}
              disabled={loading || !isPoweredOn}
              title="Change Input Source"
            >
              <FaExchangeAlt />
            </Button>
            
            <Button 
              className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('MUTE')}
              disabled={loading || !isPoweredOn}
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <FaVolumeOff /> : <FaVolumeMute />}
            </Button>
          </div>
          
          {/* Volume and Channel Controls */}
          <div className="flex justify-between mb-6">
            {/* Volume Controls */}
            <div style={{ 
              display: 'grid', 
              gridTemplateRows: 'auto auto auto',
              gap: '12px',
              justifyItems: 'center'
            }}>
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md text-xl"
                onClick={() => handleCommand('VOLUME_UP')} 
                disabled={loading || !isPoweredOn}
                style={{ width: '48px', height: '48px' }}
                title="Increase Volume"
              >
                <FaVolumeUp />
              </Button>
              <span className="text-white text-xs">VOL</span>
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md text-xl"
                onClick={() => handleCommand('VOLUME_DOWN')} 
                disabled={loading || !isPoweredOn}
                style={{ width: '48px', height: '48px' }}
                title="Decrease Volume"
              >
                <FaVolumeDown />
              </Button>
            </div>
            
            {/* Navigation D-Pad */}
            <div style={{ 
              display: 'grid',
              gridTemplateAreas: `
                ".       up      ."
                "left    ok      right"
                ".       down    ."
              `,
              gridTemplateColumns: '1fr auto 1fr',
              gridTemplateRows: 'auto auto auto',
              gap: '12px', 
              justifyItems: 'center',
              alignItems: 'center'
            }}>
              {/* Up button */}
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleCommand('UP')} 
                disabled={loading || !isPoweredOn}
                style={{ gridArea: 'up' }}
                title="Navigate Up"
              >
                ▲
              </Button>
              
              {/* Left button */}
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleCommand('LEFT')} 
                disabled={loading || !isPoweredOn}
                style={{ gridArea: 'left' }}
                title="Navigate Left"
              >
                ◀
              </Button>
              
              {/* OK button */}
              <Button 
                className="w-14 h-14 rounded-full bg-slate-500 hover:bg-slate-600 text-white font-bold text-lg shadow-md"
                onClick={() => handleCommand('OK')} 
                disabled={loading || !isPoweredOn}
                style={{ gridArea: 'ok', width: '56px', height: '56px' }}
                title="Select/Confirm"
              >
                OK
              </Button>
              
              {/* Right button */}
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleCommand('RIGHT')} 
                disabled={loading || !isPoweredOn}
                style={{ gridArea: 'right' }}
                title="Navigate Right"
              >
                ▶
              </Button>
              
              {/* Down button */}
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleCommand('DOWN')} 
                disabled={loading || !isPoweredOn}
                style={{ gridArea: 'down' }}
                title="Navigate Down"
              >
                ▼
              </Button>
            </div>
            
            {/* Channel Controls */}
            <div style={{ 
              display: 'grid', 
              gridTemplateRows: 'auto auto auto',
              gap: '12px',
              justifyItems: 'center'
            }}>
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md text-xl"
                onClick={() => handleCommand('CHANNEL_UP')} 
                disabled={loading || !isPoweredOn}
                style={{ width: '48px', height: '48px' }}
                title="Channel Up"
              >
                +
              </Button>
              <span className="text-white text-xs">CH</span>
              <Button 
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md text-xl"
                onClick={() => handleCommand('CHANNEL_DOWN')} 
                disabled={loading || !isPoweredOn}
                style={{ width: '48px', height: '48px' }}
                title="Channel Down"
              >
                -
              </Button>
            </div>
          </div>
          
          {/* Menu Controls Row */}
          <div className="flex justify-between mb-6">
            <Button 
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md" 
              onClick={() => handleCommand('BACK')} 
              disabled={loading || !isPoweredOn}
              title="Go Back"
            >
              <FaArrowLeft />
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md" 
              onClick={() => handleCommand('HOME')} 
              disabled={loading || !isPoweredOn}
              title="Go to Home Screen"
            >
              <FaHome />
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md" 
              onClick={() => handleCommand('MENU')} 
              disabled={loading || !isPoweredOn}
              title="Open Menu"
            >
              <FaBars />
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md" 
              onClick={() => handleCommand('INFO')} 
              disabled={loading || !isPoweredOn}
              title="Show Program Info"
            >
              <FaInfoCircle />
            </Button>
          </div>
          
          {/* Number Pad - in a traditional 3x4 grid */}
          <div className="mb-6">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '20rem', margin: '0 auto' }}>
              {/* Row 1: 1, 2, 3 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '1')}
                disabled={loading || !isPoweredOn}
                title="Press Number 1"
              >
                1
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '2')}
                disabled={loading || !isPoweredOn}
                title="Press Number 2"
              >
                2
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '3')}
                disabled={loading || !isPoweredOn}
                title="Press Number 3"
              >
                3
              </Button>
              
              {/* Row 2: 4, 5, 6 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '4')}
                disabled={loading || !isPoweredOn}
                title="Press Number 4"
              >
                4
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '5')}
                disabled={loading || !isPoweredOn}
                title="Press Number 5"
              >
                5
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '6')}
                disabled={loading || !isPoweredOn}
                title="Press Number 6"
              >
                6
              </Button>
              
              {/* Row 3: 7, 8, 9 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '7')}
                disabled={loading || !isPoweredOn}
                title="Press Number 7"
              >
                7
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '8')}
                disabled={loading || !isPoweredOn}
                title="Press Number 8"
              >
                8
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '9')}
                disabled={loading || !isPoweredOn}
                title="Press Number 9"
              >
                9
              </Button>
              
              {/* Row 4: EXIT, 0, GUIDE */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
                onClick={() => handleCommand('EXIT')}
                disabled={loading || !isPoweredOn}
                title="Exit Current Screen"
              >
                <FaBackspace />
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleCommand('NUMBER', '0')}
                disabled={loading || !isPoweredOn}
                title="Press Number 0"
              >
                0
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
                onClick={() => handleCommand('GUIDE')}
                disabled={loading || !isPoweredOn}
                title="Show TV Guide"
              >
                <FaList />
              </Button>
            </div>
          </div>
          
          {/* Playback Controls */}
          <div className="flex justify-between mb-6">
            <Button 
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('REWIND')} 
              disabled={loading || !isPoweredOn}
              title="Rewind"
            >
              <FaFastBackward />
            </Button>
            
            <Button 
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('PLAY')} 
              disabled={loading || !isPoweredOn}
              title="Play"
            >
              <FaPlay />
            </Button>
            
            <Button 
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('PAUSE')} 
              disabled={loading || !isPoweredOn}
              title="Pause"
            >
              <FaPause />
            </Button>
            
            <Button 
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('STOP')} 
              disabled={loading || !isPoweredOn}
              title="Stop"
            >
              <FaStop />
            </Button>
            
            <Button 
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleCommand('FAST_FORWARD')} 
              disabled={loading || !isPoweredOn}
              title="Fast Forward"
            >
              <FaFastForward />
            </Button>
          </div>
          
          {/* Smart TV App Shortcuts */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm shadow-md"
              onClick={() => handleCommand('APP_NETFLIX')} 
              disabled={loading || !isPoweredOn}
              title="Open Netflix App"
            >
              Netflix
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm shadow-md"
              onClick={() => handleCommand('APP_PRIME')} 
              disabled={loading || !isPoweredOn}
              title="Open Prime Video App"
            >
              Prime
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm shadow-md"
              onClick={() => handleCommand('APP_YOUTUBE')} 
              disabled={loading || !isPoweredOn}
              title="Open YouTube App"
            >
              YouTube
            </Button>
            
            <Button 
              className="px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm shadow-md"
              onClick={() => handleCommand('APP_DISNEY')} 
              disabled={loading || !isPoweredOn}
              title="Open Disney+ App"
            >
              Disney+
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 