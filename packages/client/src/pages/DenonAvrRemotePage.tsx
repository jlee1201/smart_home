import { useState, useEffect } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { Button, Card, Input, ToggleButton } from '@design-system';
import { FaPowerOff, FaVolumeUp, FaVolumeDown, FaVolumeMute, FaVolumeOff, FaExchangeAlt, 
         FaMusic, FaFilm, FaGamepad, FaCompactDisc, FaMicrophone, FaTv, FaSatelliteDish,
         FaBluetooth, FaNetworkWired, FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight,
         FaCheckCircle, FaUndo, FaBars, FaHome, FaPlay, FaPause, FaStop, FaStepBackward, 
         FaStepForward } from 'react-icons/fa';

// HMR test comment - this should update without a full page reload
console.log('DenonAvrRemotePage updated - HMR test', new Date().toISOString());

const DENON_AVR_STATUS_QUERY = gql`
  query GetDenonAvrStatus {
    denonAvrStatus {
      isPoweredOn
      volume
      isMuted
      input
      soundMode
    }
    denonAvrConnectionStatus {
      connected
    }
    denonAvrReachable
  }
`;

const DENON_AVR_STATUS_SUBSCRIPTION = gql`
  subscription OnDenonAvrStatusChanged {
    denonAvrStatusChanged {
      isPoweredOn
      volume
      isMuted
      input
      soundMode
    }
  }
`;

const SEND_DENON_AVR_COMMAND = gql`
  mutation SendDenonAvrCommand($command: String!, $value: String) {
    sendDenonAvrCommand(command: $command, value: $value)
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

type DenonAVRStatus = {
  isPoweredOn: boolean;
  volume: number;
  isMuted: boolean;
  input: string;
  soundMode: string;
};

type ErrorLog = {
  id: string;
  timestamp: number;
  message: string;
  details?: string;
};

// X4500H specific inputs
const AVR_X4500H_INPUTS = [
  { id: 'CBL/SAT', name: 'Cable/Satellite', icon: <FaSatelliteDish /> },
  { id: 'DVD', name: 'DVD', icon: <FaCompactDisc /> },
  { id: 'BD', name: 'Blu-ray', icon: <FaCompactDisc /> },
  { id: 'GAME', name: 'Game', icon: <FaGamepad /> },
  { id: 'AUX1', name: 'Auxiliary', icon: <FaMicrophone /> },
  { id: 'MPLAY', name: 'Media Player', icon: <FaNetworkWired /> },
  { id: 'TV', name: 'TV Audio', icon: <FaTv /> },
  { id: 'TUNER', name: 'Tuner', icon: <FaMusic /> },
  { id: 'PHONO', name: 'Phono', icon: <FaCompactDisc /> },
  { id: 'CD', name: 'CD', icon: <FaCompactDisc /> },
  { id: 'BT', name: 'Bluetooth', icon: <FaBluetooth /> },
  { id: 'NET', name: 'Network', icon: <FaNetworkWired /> },
];

// X4500H sound modes
const AVR_X4500H_SOUND_MODES = [
  { id: 'MOVIE', name: 'Movie', icon: <FaFilm /> },
  { id: 'MUSIC', name: 'Music', icon: <FaMusic /> },
  { id: 'GAME', name: 'Game', icon: <FaGamepad /> },
  { id: 'DIRECT', name: 'Direct', icon: <FaVolumeUp /> },
  { id: 'STEREO', name: 'Stereo', icon: <FaVolumeUp /> },
  { id: 'AUTO', name: 'Auto', icon: <FaExchangeAlt /> },
];

export function DenonAvrRemotePage() {
  const [volume, setVolume] = useState(50.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [currentInput, setCurrentInput] = useState('CBL/SAT');
  const [soundMode, setSoundMode] = useState('STEREO');

  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Query initial AVR status (no polling needed since we have real-time subscriptions)
  const { loading: queryLoading, data: queryData, error: queryError, refetch: refetchStatus } = useQuery<{ 
    denonAvrStatus: DenonAVRStatus; 
    denonAvrConnectionStatus: { connected: boolean }; 
    denonAvrReachable: boolean; 
  }>(DENON_AVR_STATUS_QUERY, {
    onCompleted: (data) => {
      if (data.denonAvrStatus) {
        setIsPoweredOn(data.denonAvrStatus.isPoweredOn);
        setVolume(data.denonAvrStatus.volume);
        setIsMuted(data.denonAvrStatus.isMuted);
        setCurrentInput(data.denonAvrStatus.input);
        setSoundMode(data.denonAvrStatus.soundMode);
      }
    },
    onError: (error) => {
      console.error('Error fetching Denon AVR status:', error);
      setErrorMessage('Error communicating with Denon AVR-X4500H. Will attempt to reconnect...');
    },
    // No polling needed - real-time updates come via subscriptions
    fetchPolicy: 'cache-and-network' // Use cache for faster initial load
  });
  
  // Subscribe to AVR status changes
  const { data: subscriptionData } = useSubscription<{ denonAvrStatusChanged: DenonAVRStatus }>(DENON_AVR_STATUS_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.denonAvrStatusChanged) {
        const status = data.data.denonAvrStatusChanged;
        setIsPoweredOn(status.isPoweredOn);
        setVolume(status.volume);
        setIsMuted(status.isMuted);
        setCurrentInput(status.input);
        setSoundMode(status.soundMode);
      }
    },
    onError: (error) => {
      console.error('Subscription error:', error);
      setErrorMessage('Lost connection to Denon AVR-X4500H. Attempting to reconnect...');
    }
  });
  
  // Subscribe to error logs
  const { data: errorLogData } = useSubscription<{ errorLogChanged: ErrorLog[] }>(ERROR_LOGS_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (data.data?.errorLogChanged && data.data.errorLogChanged.length > 0) {
        // Get the most recent error
        const latestError = data.data.errorLogChanged[0];
        // Only show AVR related errors (filter by message content)
        if (latestError.message.includes('AVR') || latestError.message.includes('Denon')) {
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
    if (subscriptionData?.denonAvrStatusChanged) {
      const status = subscriptionData.denonAvrStatusChanged;
      setIsPoweredOn(status.isPoweredOn);
      setVolume(status.volume);
      setIsMuted(status.isMuted);
      setCurrentInput(status.input);
      setSoundMode(status.soundMode);
    }
  }, [subscriptionData]);
  
  // Add effect to refetch status if there's an error
  useEffect(() => {
    if (queryError) {
      setErrorMessage('Error communicating with Denon AVR-X4500H. Will attempt to reconnect...');
      // Try to refetch after a delay
      const refetchTimer = setTimeout(() => {
        refetchStatus();
      }, 5000);
      
      return () => clearTimeout(refetchTimer);
    }
  }, [queryError, refetchStatus]);
  
  const [sendCommand, { loading: commandLoading, error: commandError }] = useMutation(SEND_DENON_AVR_COMMAND, {
    onError: (error) => {
      console.error('Error sending command:', error);
      setErrorMessage('Failed to send command to AVR-X4500H. The connection may have been lost.');
      refetchStatus();
    }
  });
  
  const handleCommand = async (command: string, value?: string) => {
    try {
      if (!commandError && !errorMessage.includes('Failed')) {
        setErrorMessage(''); 
      }
      
      const result = await sendCommand({ variables: { command, value } });
      
      // Check if the command failed (returned false)
      if (result.data && result.data.sendDenonAvrCommand === false) {
        setErrorMessage(`The command "${command}" failed. The AVR may be unresponsive.`);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      setErrorMessage('Failed to send command to AVR-X4500H. The connection may have been lost.');
      refetchStatus();
    }
  };

  const isAVRReachable = queryData?.denonAvrReachable === true;
  const loading = queryLoading || commandLoading;
  
  if (!isAVRReachable) {
    return (
      <div>
        <h2>Denon AVR-X4500H Remote Control</h2>
        
        <div className="grid grid-cols-1 gap-8 mt-6">
          <Card title="AVR Not Connected" subtitle="Connection required">
            <p className="mb-4">
              Your Denon AVR-X4500H is not connected. Please check your network connection and ensure the AVR is powered on.
            </p>
            <Button 
              variant="primary"
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </Button>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h2>Denon AVR-X4500H Remote Control</h2>
      
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}
      

      
      <div className="flex justify-center mt-6">
        <div className="relative w-full max-w-md bg-slate-900 rounded-3xl px-6 pt-6 pb-10 shadow-xl">
          {/* Denon logo at top */}
          <div className="text-center mb-4">
            <div className="text-white font-bold text-2xl tracking-wider">DENON</div>
            <div className="text-gray-400 text-xs tracking-wide">AVR-X4500H</div>
          </div>
          
          {/* AVR Status Display - Like a remote screen */}
          <div className="bg-slate-300 rounded-lg p-3 mb-6 text-center shadow-inner">
            <div className="font-bold text-lg mb-1">
              {isPoweredOn ? 'AVR ON' : 'AVR OFF'}
            </div>
            <div className="text-sm">
              <div><strong>Input:</strong> {currentInput}</div>
              <div><strong>Volume:</strong> {volume} {isMuted ? '(Muted)' : ''}</div>
              <div><strong>Sound Mode:</strong> {soundMode}</div>
            </div>
          </div>
          
          {/* Power & Mute Row */}
          <div className="flex justify-between mb-6">
            <ToggleButton
              variant="power"
              isActive={isPoweredOn}
              onClick={() => handleCommand(isPoweredOn ? 'POWER_OFF' : 'POWER_ON')}
              disabled={loading}
              title={isPoweredOn ? 'Turn AVR Off' : 'Turn AVR On'}
            >
              <FaPowerOff />
            </ToggleButton>
            
            <ToggleButton
              variant="mute"
              isActive={isMuted}
              onClick={() => handleCommand('MUTE_TOGGLE')}
              disabled={loading || !isPoweredOn}
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <FaVolumeOff /> : <FaVolumeMute />}
            </ToggleButton>
          </div>
          
          {/* Volume Control with Bar Graph Style */}
          <div className="mb-6 w-full">
            <div className="text-white mb-3 font-medium text-center">Volume Control</div>
            
            {/* Volume level display */}
            <div className="text-center text-white text-lg font-bold mb-3">
              {volume}{isMuted ? ' (Muted)' : ''}
            </div>
            
            {/* Horizontal layout: Vol Down | Bar Graph | Vol Up */}
            <div className="flex items-end justify-between gap-4 w-full">
              {/* Volume Down Button */}
              <Button 
                className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center flex-shrink-0"
                onClick={() => handleCommand('VOLUME_DOWN')}
                disabled={loading || !isPoweredOn}
              >
                <FaVolumeDown className="text-xl" />
              </Button>
              
              {/* Bar graph style volume visualization */}
              <div className="flex items-end justify-center gap-1 h-10 flex-1">
                {Array.from({ length: 20 }, (_, i) => {
                  const barLevel = (i + 1) * 5; // Each bar represents 5 volume levels (0-100)
                  const isActive = volume >= barLevel;
                  const barHeight = `${10 + (i * 1.5)}px`; // Reduced height progression (50% of original)
                  
                  return (
                    <div
                      key={i}
                      className="transition-all duration-200"
                      style={{
                        width: '8px',
                        height: barHeight,
                        backgroundColor: isActive 
                          ? (isMuted ? '#BB8274' : '#6A869C') // terracotta when muted, blue when normal
                          : '#4F4F4F', // farmhouse-charcoal for inactive bars
                        opacity: isActive ? (isMuted ? 0.7 : 1) : 0.3,
                        borderRadius: '2px',
                        boxShadow: isActive && !isMuted ? '0 0 4px rgba(106, 134, 156, 0.4)' : 'none'
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Volume Up Button */}
              <Button 
                className="w-14 h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center flex-shrink-0"
                onClick={() => handleCommand('VOLUME_UP')}
                disabled={loading || !isPoweredOn}
              >
                <FaVolumeUp className="text-xl" />
              </Button>
            </div>
          </div>
          
          {/* Input Selection */}
          <div className="mb-6">
            <div className="text-white mb-2 font-medium">Input Selection</div>
            <div className="grid grid-cols-3 gap-2">
              {AVR_X4500H_INPUTS.map(input => (
                <ToggleButton
                  key={input.id}
                  variant="input"
                  isActive={currentInput === input.id}
                  onClick={() => handleCommand(`INPUT_${input.id.replace('/', '_')}`)}
                  disabled={loading || !isPoweredOn}
                  title={input.name}
                  className="h-12 flex-col text-xs"
                >
                  <span className="text-lg mb-1">{input.icon}</span>
                  <span className="truncate">{input.name}</span>
                </ToggleButton>
              ))}
            </div>
          </div>
          
          {/* Sound Mode Selection */}
          <div className="mb-6">
            <div className="text-white mb-2 font-medium">Sound Mode</div>
            <div className="grid grid-cols-3 gap-2">
              {AVR_X4500H_SOUND_MODES.map(mode => (
                <ToggleButton
                  key={mode.id}
                  variant="sound-mode"
                  isActive={soundMode === mode.id}
                  onClick={() => handleCommand(`SOUND_${mode.id}`)}
                  disabled={loading || !isPoweredOn}
                  title={mode.name}
                  className="h-12 flex-col text-xs"
                >
                  <span className="text-lg mb-1">{mode.icon}</span>
                  <span>{mode.name}</span>
                </ToggleButton>
              ))}
            </div>
          </div>
          
          {/* Navigation Controls */}
          <div className="mb-6">
            <div className="text-white mb-2 font-medium">Navigation Controls</div>
            <div className="flex justify-center mb-2">
              <div className="grid grid-cols-3 gap-2 w-4/5">
                <div></div>
                <Button 
                  className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center mx-auto"
                  onClick={() => handleCommand('NAVIGATE', 'UP')}
                  disabled={loading || !isPoweredOn}
                >
                  <FaArrowUp />
                </Button>
                <div></div>
                
                <Button 
                  className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                  onClick={() => handleCommand('NAVIGATE', 'LEFT')}
                  disabled={loading || !isPoweredOn}
                >
                  <FaArrowLeft />
                </Button>
                
                <Button 
                  className="h-12 w-12 rounded-full bg-slate-600 hover:bg-slate-500 text-white shadow-md flex items-center justify-center"
                  onClick={() => handleCommand('NAVIGATE', 'SELECT')}
                  disabled={loading || !isPoweredOn}
                >
                  <FaCheckCircle />
                </Button>
                
                <Button 
                  className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                  onClick={() => handleCommand('NAVIGATE', 'RIGHT')}
                  disabled={loading || !isPoweredOn}
                >
                  <FaArrowRight />
                </Button>
                
                <div></div>
                <Button 
                  className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center mx-auto"
                  onClick={() => handleCommand('NAVIGATE', 'DOWN')}
                  disabled={loading || !isPoweredOn}
                >
                  <FaArrowDown />
                </Button>
                <div></div>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button 
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('NAVIGATE', 'MENU')}
                disabled={loading || !isPoweredOn}
              >
                <FaBars className="mr-1" /> Menu
              </Button>
              
              <Button 
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('NAVIGATE', 'RETURN')}
                disabled={loading || !isPoweredOn}
              >
                <FaUndo className="mr-1" /> Return
              </Button>
              
              <Button 
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('NAVIGATE', 'HOME')}
                disabled={loading || !isPoweredOn}
              >
                <FaHome className="mr-1" /> Home
              </Button>
            </div>
          </div>
          
          {/* Playback Controls */}
          <div className="mb-4">
            <div className="text-white mb-2 font-medium">Playback Controls</div>
            <div className="flex justify-between">
              <Button 
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('PLAYBACK', 'PREVIOUS')}
                disabled={loading || !isPoweredOn}
              >
                <FaStepBackward />
              </Button>
              
              <Button 
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('PLAYBACK', 'PLAY')}
                disabled={loading || !isPoweredOn}
              >
                <FaPlay />
              </Button>
              
              <Button 
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('PLAYBACK', 'PAUSE')}
                disabled={loading || !isPoweredOn}
              >
                <FaPause />
              </Button>
              
              <Button 
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('PLAYBACK', 'STOP')}
                disabled={loading || !isPoweredOn}
              >
                <FaStop />
              </Button>
              
              <Button 
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md flex items-center justify-center"
                onClick={() => handleCommand('PLAYBACK', 'NEXT')}
                disabled={loading || !isPoweredOn}
              >
                <FaStepForward />
              </Button>
            </div>
          </div>
          
          {/* Model info */}
          <div className="text-center text-gray-400 text-xs mt-6">
            Denon AVR-X4500H Smart Home Controller
          </div>
        </div>
      </div>
    </div>
  );
} 