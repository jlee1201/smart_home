import { useState, useEffect } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { Button, Card, Input } from '@design-system';

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

type DenonAVRStatus = {
  isPoweredOn: boolean;
  volume: number;
  isMuted: boolean;
  input: string;
  soundMode: string;
};

export function DenonAvrRemotePage() {
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isPoweredOn, setIsPoweredOn] = useState(false);
  const [currentInput, setCurrentInput] = useState('CBL/SAT');
  const [soundMode, setSoundMode] = useState('STEREO');
  const [customVolume, setCustomVolume] = useState('');
  
  // Query initial AVR status
  const { loading: queryLoading, data: queryData } = useQuery<{ 
    denonAvrStatus: DenonAVRStatus; 
    denonAvrConnectionStatus: { connected: boolean } 
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
    }
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
  
  const [sendCommand, { loading: commandLoading }] = useMutation(SEND_DENON_AVR_COMMAND);
  
  const handleCommand = async (command: string, value?: string) => {
    try {
      await sendCommand({ variables: { command, value } });
    } catch (error) {
      console.error('Error sending command:', error);
    }
  };

  const handleSetCustomVolume = () => {
    const vol = parseInt(customVolume, 10);
    if (!isNaN(vol) && vol >= 0 && vol <= 100) {
      handleCommand('SET_VOLUME', customVolume);
      setCustomVolume('');
    }
  };

  const isAVRConnected = queryData?.denonAvrConnectionStatus?.connected === true;
  const loading = queryLoading || commandLoading;
  
  if (!isAVRConnected) {
    return (
      <div>
        <h2>Denon AVR Remote Control</h2>
        
        <div className="grid grid-cols-1 gap-8 mt-6">
          <Card title="AVR Not Connected" subtitle="Connection required">
            <p className="mb-4">
              Your Denon AVR is not connected. Please check your network connection and ensure the AVR is powered on.
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
      <h2>Denon AVR Remote Control</h2>
      
      <div className="grid grid-cols-1 gap-8 mt-6">
        <Card title="Status" subtitle="Current AVR status">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Power:</strong> {isPoweredOn ? 'On' : 'Off'}
            </div>
            <div>
              <strong>Input:</strong> {currentInput}
            </div>
            <div>
              <strong>Volume:</strong> {volume}% {isMuted ? '(Muted)' : ''}
            </div>
            <div>
              <strong>Sound Mode:</strong> {soundMode}
            </div>
          </div>
        </Card>
        
        <Card title="Power Control" subtitle="Turn AVR on/off">
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="primary"
              onClick={() => handleCommand('POWER_ON')}
              disabled={loading || isPoweredOn}
            >
              Power On
            </Button>
            
            <Button 
              variant="danger"
              onClick={() => handleCommand('POWER_OFF')}
              disabled={loading || !isPoweredOn}
            >
              Power Off
            </Button>
          </div>
        </Card>
        
        <Card title="Input Selection" subtitle="Select input source">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleCommand('INPUT_TV')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'TV' ? 'primary' : 'secondary'}
            >
              TV
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_BLURAY')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'BD' ? 'primary' : 'secondary'}
            >
              Blu-ray
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_GAME')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'GAME' ? 'primary' : 'secondary'}
            >
              Game
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_CBL_SAT')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'CBL/SAT' ? 'primary' : 'secondary'}
            >
              Cable/Sat
            </Button>
            
            <Button 
              onClick={() => handleCommand('INPUT_BLUETOOTH')} 
              disabled={loading || !isPoweredOn}
              variant={currentInput === 'BT' ? 'primary' : 'secondary'}
            >
              Bluetooth
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
          
          <div className="flex flex-wrap gap-4 mb-4">
            <Button onClick={() => handleCommand('VOLUME_UP')} disabled={loading || !isPoweredOn}>
              Volume +
            </Button>
            
            <Button onClick={() => handleCommand('VOLUME_DOWN')} disabled={loading || !isPoweredOn}>
              Volume -
            </Button>
            
            <Button 
              variant={isMuted ? "primary" : "secondary"}
              onClick={() => handleCommand('MUTE_TOGGLE')}
              disabled={loading || !isPoweredOn}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <Input
              type="number"
              min="0"
              max="100"
              value={customVolume}
              onChange={(e) => setCustomVolume(e.target.value)}
              placeholder="Set volume (0-100)"
              disabled={loading || !isPoweredOn}
              className="w-40"
            />
            <Button 
              onClick={handleSetCustomVolume} 
              disabled={loading || !isPoweredOn || !customVolume}
            >
              Set
            </Button>
          </div>
        </Card>
        
        <Card title="Sound Mode" subtitle="Change sound processing mode">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleCommand('SOUND_MOVIE')} 
              disabled={loading || !isPoweredOn}
              variant={soundMode === 'MOVIE' ? 'primary' : 'secondary'}
            >
              Movie
            </Button>
            
            <Button 
              onClick={() => handleCommand('SOUND_MUSIC')} 
              disabled={loading || !isPoweredOn}
              variant={soundMode === 'MUSIC' ? 'primary' : 'secondary'}
            >
              Music
            </Button>
            
            <Button 
              onClick={() => handleCommand('SOUND_GAME')} 
              disabled={loading || !isPoweredOn}
              variant={soundMode === 'GAME' ? 'primary' : 'secondary'}
            >
              Game
            </Button>
            
            <Button 
              onClick={() => handleCommand('SOUND_DIRECT')} 
              disabled={loading || !isPoweredOn}
              variant={soundMode === 'DIRECT' ? 'primary' : 'secondary'}
            >
              Direct
            </Button>
            
            <Button 
              onClick={() => handleCommand('SOUND_STEREO')} 
              disabled={loading || !isPoweredOn}
              variant={soundMode === 'STEREO' ? 'primary' : 'secondary'}
            >
              Stereo
            </Button>
          </div>
        </Card>
        
        <Card title="Navigation Controls" subtitle="Menu navigation">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div></div>
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'UP')} 
              disabled={loading || !isPoweredOn}
            >
              ▲
            </Button>
            <div></div>
            
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'LEFT')} 
              disabled={loading || !isPoweredOn}
            >
              ◀
            </Button>
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'SELECT')} 
              disabled={loading || !isPoweredOn}
            >
              OK
            </Button>
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'RIGHT')} 
              disabled={loading || !isPoweredOn}
            >
              ▶
            </Button>
            
            <div></div>
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'DOWN')} 
              disabled={loading || !isPoweredOn}
            >
              ▼
            </Button>
            <div></div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'MENU')} 
              disabled={loading || !isPoweredOn}
            >
              Menu
            </Button>
            
            <Button 
              onClick={() => handleCommand('NAVIGATE', 'RETURN')} 
              disabled={loading || !isPoweredOn}
            >
              Return
            </Button>
          </div>
        </Card>
        
        <Card title="Playback Controls" subtitle="Media playback controls">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleCommand('PLAYBACK', 'PLAY')} 
              disabled={loading || !isPoweredOn}
            >
              ▶ Play
            </Button>
            
            <Button 
              onClick={() => handleCommand('PLAYBACK', 'PAUSE')} 
              disabled={loading || !isPoweredOn}
            >
              ⏸ Pause
            </Button>
            
            <Button 
              onClick={() => handleCommand('PLAYBACK', 'STOP')} 
              disabled={loading || !isPoweredOn}
            >
              ⏹ Stop
            </Button>
            
            <Button 
              onClick={() => handleCommand('PLAYBACK', 'PREVIOUS')} 
              disabled={loading || !isPoweredOn}
            >
              ⏮ Previous
            </Button>
            
            <Button 
              onClick={() => handleCommand('PLAYBACK', 'NEXT')} 
              disabled={loading || !isPoweredOn}
            >
              ⏭ Next
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
} 