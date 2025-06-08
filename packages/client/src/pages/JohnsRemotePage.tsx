import { useState, useEffect, useRef } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { Button, Card, ToggleButton, VolumeBar } from '@design-system';
import { Link } from 'react-router-dom';
import {
  FaPowerOff,
  FaVolumeUp,
  FaVolumeDown,
  FaVolumeMute,
  FaVolumeOff,
  FaArrowLeft,
  FaHome,
  FaBars,
  FaInfoCircle,
  FaBackspace,
  FaList,
  FaFastBackward,
  FaPlay,
  FaPause,
  FaStop,
  FaFastForward,
  FaTv,
  FaHdd,
  FaDesktop,
  FaVideo,
  FaPowerOff as FaAllOn,
} from 'react-icons/fa';
import { SiNetflix, SiYoutube, SiAmazonprime } from 'react-icons/si';

// GraphQL Queries and Mutations
const TV_STATUS_QUERY = gql`
  query GetTVStatus {
    tvStatus {
      isPoweredOn
      volume
      channel
      isMuted
      input
      currentApp
      speakersOn
    }
    tvConnectionStatus {
      connected
    }
  }
`;

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

const TV_STATUS_SUBSCRIPTION = gql`
  subscription OnTVStatusChanged {
    tvStatusChanged {
      isPoweredOn
      volume
      channel
      isMuted
      input
      currentApp
      speakersOn
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

const SEND_TV_COMMAND = gql`
  mutation SendTVCommand($command: String!, $value: String) {
    sendTVCommand(command: $command, value: $value)
  }
`;

const SEND_DENON_AVR_COMMAND = gql`
  mutation SendDenonAvrCommand($command: String!, $value: String) {
    sendDenonAvrCommand(command: $command, value: $value)
  }
`;

const SYNC_DEVICES = gql`
  mutation SyncDevices {
    syncDevices
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

// Types
type TVStatus = {
  isPoweredOn: boolean;
  volume: number;
  channel: string;
  isMuted: boolean;
  input: string;
  currentApp: string;
  speakersOn: boolean;
};

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

// Custom Icons - matching Vizio remote exactly
const DisneyPlusIcon = () => (
  <svg
    viewBox="0 0 1041 565"
    style={{
      width: '48px',
      height: '26px', // Calculated: 48 * (565/1041) ≈ 26px to maintain aspect ratio
    }}
    fill="currentColor"
  >
    <g>
      <g>
        <g>
          <g>
            <path d="M735.8 365.7 C721.4 369 683.5 370.9 683.5 370.9 L678.7 385.9 C678.7 385.9 697.6 384.3 711.4 385.7 711.4 385.7 715.9 385.2 716.4 390.8 716.6 396 716 401.6 716 401.6 716 401.6 715.7 405 710.9 405.8 705.7 406.7 670.1 408 670.1 408 L664.3 427.5 C664.3 427.5 662.2 432 667 430.7 671.5 429.5 708.8 422.5 713.7 423.5 718.9 424.8 724.7 431.7 723 438.1 721 445.9 683.8 469.7 661.1 468 661.1 468 649.2 468.8 639.1 452.7 629.7 437.4 642.7 408.3 642.7 408.3 642.7 408.3 636.8 394.7 641.1 390.2 641.1 390.2 643.7 387.9 651.1 387.3 L660.2 368.4 C660.2 368.4 649.8 369.1 643.6 361.5 637.8 354.2 637.4 350.9 641.8 348.9 646.5 346.6 689.8 338.7 719.6 339.7 719.6 339.7 730 338.7 738.9 356.7 738.8 356.7 743.2 364 735.8 365.7 Z M623.7 438.3 C619.9 447.3 609.8 456.9 597.3 450.9 584.9 444.9 565.2 404.6 565.2 404.6 565.2 404.6 557.7 389.6 556.3 389.9 556.3 389.9 554.7 387 553.7 403.4 552.7 419.8 553.9 451.7 547.4 456.7 541.2 461.7 533.7 459.7 529.8 453.8 526.3 448 524.8 434.2 526.7 410 529 385.8 534.6 360 541.8 351.9 549 343.9 554.8 349.7 557 351.8 557 351.8 566.6 360.5 582.5 386.1 L585.3 390.8 C585.3 390.8 599.7 415 601.2 414.9 601.2 414.9 602.4 416 603.4 415.2 604.9 414.8 604.3 407 604.3 407 604.3 407 601.3 380.7 588.2 336.1 588.2 336.1 586.2 330.5 587.6 325.3 588.9 320 594.2 322.5 594.2 322.5 594.2 322.5 614.6 332.7 624.4 365.9 634.1 399.4 627.5 429.3 623.7 438.3 Z M523.5 353 C521.8 356.4 520.8 361.3 512.2 362.6 512.2 362.6 429.9 368.2 426 374 426 374 423.1 377.4 427.6 378.4 432.1 379.3 450.7 381.8 459.7 382.3 469.3 382.4 501.7 382.7 513.3 397.2 513.3 397.2 520.2 404.1 519.9 419.7 519.6 435.7 516.8 441.3 510.6 447.1 504.1 452.5 448.3 477.5 412.3 439.1 412.3 439.1 395.7 420.6 418 406.6 418 406.6 434.1 396.9 475 408.3 475 408.3 487.4 412.8 486.8 417.3 486.1 422.1 476.6 427.2 462.8 426.9 449.4 426.5 439.6 420.1 441.5 421.1 443.3 421.8 427.1 413.3 422.1 419.1 417.1 424.4 418.3 427.7 423.2 431 435.7 438.1 484 435.6 498.4 419.6 498.4 419.6 504.1 413.1 495.4 407.8 486.7 402.8 461.8 399.8 452.1 399.3 442.8 398.8 408.2 399.4 403.2 390.2 403.2 390.2 398.2 384 403.7 366.4 409.5 348 449.8 340.9 467.2 339.3 467.2 339.3 515.1 337.6 523.9 347.4 523.8 347.4 525 349.7 523.5 353 Z M387.5 460.9 C381.7 465.2 369.4 463.3 365.9 458.5 362.4 454.2 361.2 437.1 361.9 410.3 362.6 383.2 363.2 349.6 369 344.3 375.2 338.9 379 343.6 381.4 347.3 384 350.9 387.1 354.9 387.8 363.4 388.4 371.9 390.4 416.5 390.4 416.5 390.4 416.5 393 456.7 387.5 460.9 Z M400 317.1 C383.1 322.7 371.5 320.8 361.7 316.6 357.4 324.1 354.9 326.4 351.6 326.9 346.8 327.4 342.5 319.7 341.7 317.2 340.9 315.3 338.6 312.1 341.4 304.5 331.8 295.9 331.1 284.3 332.7 276.5 335.1 267.5 351.3 233.3 400.6 229.3 400.6 229.3 424.7 227.5 428.8 240.4 L429.5 240.4 C429.5 240.4 452.9 240.5 452.4 261.3 452.1 282.2 426.4 308.2 400 317.1 Z M354 270.8 C349 278.8 348.8 283.6 351.1 286.9 356.8 278.2 367.2 264.5 382.5 254.1 370.7 255.1 360.8 260.2 354 270.8 Z M422.1 257.4 C406.6 259.7 382.6 280.5 371.2 297.5 388.7 300.7 419.6 299.5 433.3 271.6 433.2 271.6 439.8 254.3 422.1 257.4 Z M842.9 418.5 C833.6 434.7 807.5 468.5 772.7 460.6 761.2 488.5 751.6 516.6 746.1 558.8 746.1 558.8 744.9 567 738.1 564.1 731.4 561.7 720.2 550.5 718 535 715.6 514.6 724.7 480.1 743.2 440.6 737.8 431.8 734.1 419.2 737.3 401.3 737.3 401.3 742 368.1 775.3 338.1 775.3 338.1 779.3 334.6 781.6 335.7 784.2 336.8 783 347.6 780.9 352.8 778.8 358 763.9 383.8 763.9 383.8 763.9 383.8 754.6 401.2 757.2 414.9 774.7 388 814.5 333.7 839.2 350.8 847.5 356.7 851.3 369.6 851.3 383.5 851.2 395.8 848.3 408.8 842.9 418.5 Z M835.7 375.9 C835.7 375.9 834.3 365.2 823.9 377 814.9 386.9 798.7 405.6 785.6 430.9 799.3 429.4 812.5 421.9 816.5 418.1 823 412.3 838.1 396.7 835.7 375.9 Z M350.2 389.5 C348.3 413.7 339 454.4 273.1 474.5 229.6 487.6 188.5 481.3 166.1 475.6 165.6 484.5 164.6 488.3 163.2 489.8 161.3 491.7 147.1 499.9 139.3 488.3 135.8 482.8 134 472.8 133 463.9 82.6 440.7 59.4 407.3 58.5 405.8 57.4 404.7 45.9 392.7 57.4 378 68.2 364.7 103.5 351.4 135.3 346 136.4 318.8 139.6 298.3 143.4 288.9 148 278 153.8 287.8 158.8 295.2 163 300.7 165.5 324.4 165.7 343.3 186.5 342.3 198.8 343.8 222 348 252.2 353.5 272.4 368.9 270.6 386.4 269.3 403.6 253.5 410.7 247.5 411.2 241.2 411.7 231.4 407.2 231.4 407.2 224.7 404 230.9 401.2 239 397.7 247.8 393.4 245.8 389 245.8 389 242.5 379.4 203.3 372.7 164.3 372.7 164.1 394.2 165.2 429.9 165.7 450.7 193 455.9 213.4 454.9 213.4 454.9 213.4 454.9 313 452.1 316 388.5 319.1 324.8 216.7 263.7 141 244.3 65.4 224.5 22.6 238.3 18.9 240.2 14.9 242.2 18.6 242.8 18.6 242.8 18.6 242.8 22.7 243.4 29.8 245.8 37.3 248.2 31.5 252.1 31.5 252.1 18.6 256.2 4.1 253.6 1.3 247.7 -1.5 241.8 3.2 236.5 8.6 228.9 14 220.9 19.9 221.2 19.9 221.2 113.4 188.8 227.3 247.4 227.3 247.4 334 301.5 352.2 364.9 350.2 389.5 Z M68 386.2 C57.4 391.4 64.7 398.9 64.7 398.9 84.6 420.3 109.1 433.7 132.4 442 135.1 405.1 134.7 392.1 135 373.5 98.6 376 77.6 381.8 68 386.2 Z" />
          </g>
        </g>
        <g>
          <g>
            <g>
              <path d="M1040.9 378.6 L1040.9 391.8 C1040.9 394.7 1038.6 397 1035.7 397 L972.8 397 C972.8 400.3 972.9 403.2 972.9 405.9 972.9 425.4 972.1 441.3 970.2 459.2 969.9 461.9 967.7 463.9 965.1 463.9 L951.5 463.9 C950.1 463.9 948.8 463.3 947.9 462.3 947 461.3 946.5 459.9 946.7 458.5 948.6 440.7 949.5 425 949.5 405.9 949.5 403.1 949.5 400.2 949.4 397 L887.2 397 C884.3 397 882 394.7 882 391.8 L882 378.6 C882 375.7 884.3 373.4 887.2 373.4 L948.5 373.4 C947.2 351.9 944.6 331.2 940.4 310.2 940.2 308.9 940.5 307.6 941.3 306.6 942.1 305.6 943.3 305 944.6 305 L959.3 305 C961.6 305 963.5 306.6 964 308.9 968.1 330.6 970.7 351.7 972 373.4 L1035.7 373.4 C1038.5 373.4 1040.9 375.8 1040.9 378.6 Z" />
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>
);

// Netflix logo component with proper proportions (roughly square)
const NetflixIcon = () => (
  <div style={{ width: '40px', height: '40px' }}>
    <SiNetflix style={{ width: '100%', height: '100%' }} />
  </div>
);

// Amazon Prime logo component with proper proportions (wider than tall)
const AmazonPrimeIcon = () => (
  <div
    style={{
      width: '80px',
      height: '16px',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <SiAmazonprime
      style={{
        width: '200%',
        height: '200%',
        transform: 'scale(2.5)', // Scaling to remove built-in whitespace
        display: 'block',
      }}
    />
  </div>
);

// YouTube logo component with proper proportions (wider than tall)
const YouTubeIcon = () => (
  <div style={{ width: '48px', height: '34px' }}>
    <SiYoutube style={{ width: '100%', height: '100%' }} />
  </div>
);

// TV Apps and Inputs
const VIZIO_TV_APPS = [
  {
    id: 'APP_NETFLIX',
    name: 'Netflix',
    displayName: 'Netflix',
    icon: <NetflixIcon />,
    color: 'bg-red-600 hover:bg-red-700',
  },
  {
    id: 'APP_PRIME',
    name: 'Prime Video',
    displayName: 'Prime',
    icon: <AmazonPrimeIcon />,
    color: 'bg-sky-600 hover:bg-sky-700',
  },
  {
    id: 'APP_YOUTUBE_TV',
    name: 'YouTube TV',
    displayName: 'YouTube TV',
    icon: <YouTubeIcon />,
    color: 'bg-red-500 hover:bg-red-600',
  },
  {
    id: 'APP_DISNEY',
    name: 'Disney+',
    displayName: 'Disney+',
    icon: <DisneyPlusIcon />,
    color: 'bg-blue-700 hover:bg-blue-800',
  },
];

const VIZIO_TV_INPUTS = [
  { id: 'HDMI_1', name: 'HDMI 1', icon: <FaHdd /> },
  { id: 'HDMI_2', name: 'HDMI 2', icon: <FaHdd /> },
  { id: 'HDMI_3', name: 'HDMI 3', icon: <FaHdd /> },
  { id: 'HDMI_4', name: 'HDMI 4', icon: <FaHdd /> },
  { id: 'TV', name: 'TV', icon: <FaTv /> },
  { id: 'SMARTCAST', name: 'SmartCast', icon: <FaDesktop /> },
];

export function JohnsRemotePage() {
  // TV State
  const [tvVolume, setTvVolume] = useState(50);
  const [tvChannel, setTvChannel] = useState('');
  const [tvIsMuted, setTvIsMuted] = useState(false);
  const [tvIsPoweredOn, setTvIsPoweredOn] = useState(false);
  const [tvCurrentInput, setTvCurrentInput] = useState('HDMI_1');
  const [tvCurrentApp, setTvCurrentApp] = useState('Unknown');
  const [tvSpeakersOn, setTvSpeakersOn] = useState(true);

  // AVR State
  const [avrVolume, setAvrVolume] = useState(50.0);
  const [avrIsMuted, setAvrIsMuted] = useState(false);
  const [avrIsPoweredOn, setAvrIsPoweredOn] = useState(false);
  const [avrCurrentInput, setAvrCurrentInput] = useState('TV');
  const [avrSoundMode, setAvrSoundMode] = useState('STEREO');

  const [errorMessage, setErrorMessage] = useState<string>('');

  // TV Queries and Subscriptions
  const {
    loading: tvQueryLoading,
    data: tvQueryData,
    error: tvQueryError,
    refetch: refetchTvStatus,
  } = useQuery<{
    tvStatus: TVStatus;
    tvConnectionStatus: { connected: boolean };
  }>(TV_STATUS_QUERY, {
    onCompleted: data => {
      if (data.tvStatus) {
        setTvIsPoweredOn(data.tvStatus.isPoweredOn);
        setTvVolume(data.tvStatus.volume);
        setTvChannel(data.tvStatus.channel);
        setTvIsMuted(data.tvStatus.isMuted);
        setTvCurrentInput(data.tvStatus.input);
        setTvCurrentApp(data.tvStatus.currentApp);
        setTvSpeakersOn(data.tvStatus.speakersOn);
      }
    },
    onError: error => {
      console.error('Error fetching TV status:', error);
      setErrorMessage('Error communicating with TV. Will attempt to reconnect...');
    },
    fetchPolicy: 'cache-and-network',
  });

  // AVR Queries and Subscriptions
  const {
    loading: avrQueryLoading,
    data: avrQueryData,
    error: avrQueryError,
    refetch: refetchAvrStatus,
  } = useQuery<{
    denonAvrStatus: DenonAVRStatus;
    denonAvrConnectionStatus: { connected: boolean };
  }>(DENON_AVR_STATUS_QUERY, {
    onCompleted: data => {
      if (data.denonAvrStatus) {
        setAvrIsPoweredOn(data.denonAvrStatus.isPoweredOn);
        setAvrVolume(data.denonAvrStatus.volume);
        setAvrIsMuted(data.denonAvrStatus.isMuted);
        setAvrCurrentInput(data.denonAvrStatus.input);
        setAvrSoundMode(data.denonAvrStatus.soundMode);
      }
    },
    onError: error => {
      console.error('Error fetching AVR status:', error);
      setErrorMessage('Error communicating with Denon AVR. Will attempt to reconnect...');
    },
    fetchPolicy: 'cache-and-network',
  });

  // TV Status Subscription
  const { data: tvSubscriptionData } = useSubscription<{ tvStatusChanged: TVStatus }>(
    TV_STATUS_SUBSCRIPTION,
    {
      onData: ({ data }) => {
        if (data.data?.tvStatusChanged) {
          const status = data.data.tvStatusChanged;
          setTvIsPoweredOn(status.isPoweredOn);
          setTvVolume(status.volume);
          setTvChannel(status.channel);
          setTvIsMuted(status.isMuted);
          setTvCurrentInput(status.input);
          setTvCurrentApp(status.currentApp);
          setTvSpeakersOn(status.speakersOn);
        }
      },
      onError: error => {
        console.error('TV subscription error:', error);
        setErrorMessage('Lost connection to TV. Attempting to reconnect...');
      },
    }
  );

  // AVR Status Subscription
  const { data: avrSubscriptionData } = useSubscription<{ denonAvrStatusChanged: DenonAVRStatus }>(
    DENON_AVR_STATUS_SUBSCRIPTION,
    {
      onData: ({ data }) => {
        if (data.data?.denonAvrStatusChanged) {
          const status = data.data.denonAvrStatusChanged;
          setAvrIsPoweredOn(status.isPoweredOn);
          setAvrVolume(status.volume);
          setAvrIsMuted(status.isMuted);
          setAvrCurrentInput(status.input);
          setAvrSoundMode(status.soundMode);
        }
      },
      onError: error => {
        console.error('AVR subscription error:', error);
        setErrorMessage('Lost connection to Denon AVR. Attempting to reconnect...');
      },
    }
  );

  // Error Log Subscription
  const { data: errorLogData } = useSubscription<{ errorLogChanged: ErrorLog[] }>(
    ERROR_LOGS_SUBSCRIPTION,
    {
      onData: ({ data }) => {
        if (data.data?.errorLogChanged && data.data.errorLogChanged.length > 0) {
          const latestError = data.data.errorLogChanged[0];
          if (
            latestError.message.includes('TV') ||
            latestError.message.includes('AVR') ||
            latestError.message.includes('Sync')
          ) {
            setErrorMessage(latestError.message);
            setTimeout(() => {
              setErrorMessage('');
            }, 5000);
          }
        }
      },
      onError: error => {
        console.error('Error log subscription error:', error);
      },
    }
  );

  // Mutations
  const [sendTvCommand, { loading: tvCommandLoading, error: tvCommandError }] = useMutation(
    SEND_TV_COMMAND,
    {
      onError: error => {
        console.error('Error sending TV command:', error);
        setErrorMessage('Failed to send command to TV. The connection may have been lost.');
        refetchTvStatus();
      },
    }
  );

  const [sendAvrCommand, { loading: avrCommandLoading, error: avrCommandError }] = useMutation(
    SEND_DENON_AVR_COMMAND,
    {
      onError: error => {
        console.error('Error sending AVR command:', error);
        setErrorMessage('Failed to send command to Denon AVR. The connection may have been lost.');
        refetchAvrStatus();
      },
    }
  );

  const [allOnDevices, { loading: allOnLoading, error: allOnError }] = useMutation(SYNC_DEVICES, {
    onError: error => {
      console.error('Error with All On operation:', error);
      setErrorMessage('Failed to turn on devices. Please check connections.');
    },
    onCompleted: () => {
      setErrorMessage('');
      // Show success message briefly
      setErrorMessage('All devices turned on successfully!');
      setTimeout(() => {
        setErrorMessage('');
      }, 3000);
    },
  });

  // Command Handlers
  const handleTvCommand = async (command: string, value?: string) => {
    try {
      if (!tvCommandError && !errorMessage.includes('Failed')) {
        setErrorMessage('');
      }

      const result = await sendTvCommand({ variables: { command, value } });

      if (result.data && result.data.sendTVCommand === false) {
        setErrorMessage(`The TV command "${command}" failed. The TV may be unresponsive.`);
      }
    } catch (error) {
      console.error('Error sending TV command:', error);
      setErrorMessage('Failed to send command to TV. The connection may have been lost.');
      refetchTvStatus();
    }
  };

  const handleAvrCommand = async (command: string, value?: string) => {
    try {
      if (!avrCommandError && !errorMessage.includes('Failed')) {
        setErrorMessage('');
      }

      const result = await sendAvrCommand({ variables: { command, value } });

      if (result.data && result.data.sendDenonAvrCommand === false) {
        setErrorMessage(`The AVR command "${command}" failed. The AVR may be unresponsive.`);
      }
    } catch (error) {
      console.error('Error sending AVR command:', error);
      setErrorMessage('Failed to send command to Denon AVR. The connection may have been lost.');
      refetchAvrStatus();
    }
  };

  const handleAllOn = async () => {
    try {
      setErrorMessage('Turning on devices...');
      await allOnDevices();
    } catch (error) {
      console.error('Error with All On operation:', error);
      setErrorMessage('Failed to turn on devices. Please check connections.');
    }
  };

  // Handle AVR volume change from drag
  const handleAvrVolumeChange = (vol: number) => {
    setAvrVolume(vol);
    handleAvrCommand('SET_VOLUME', vol.toString());
  };

  // Connection Status
  const isTVConnected = tvQueryData?.tvConnectionStatus?.connected === true;
  const isAVRConnected = avrQueryData?.denonAvrConnectionStatus?.connected === true;
  const loading =
    tvQueryLoading || avrQueryLoading || tvCommandLoading || avrCommandLoading || allOnLoading;

  // All On button should be disabled only when both devices are already on and properly configured
  // It should be enabled when either device is off or AVR is not set to TV input
  const isAllOnDisabled = tvIsPoweredOn && avrIsPoweredOn && avrCurrentInput === 'TV';

  // Check if both devices are connected
  if (!isTVConnected || !isAVRConnected) {
    return (
      <div>
        <h2>John's Remote</h2>

        <div className="grid grid-cols-1 gap-8 mt-6">
          {!isTVConnected && (
            <Card title="TV Not Connected" subtitle="Connection required">
              <p className="mb-4">
                Your TV is not connected. You need to pair with your Vizio TV before you can use
                John's Remote.
              </p>
              <Link to="/tv-pairing" className="farmhouse-btn farmhouse-btn-primary">
                Go to TV Setup
              </Link>
            </Card>
          )}

          {!isAVRConnected && (
            <Card title="AVR Not Connected" subtitle="Connection required">
              <p className="mb-4">
                Your Denon AVR is not connected. Please check your network connection and ensure the
                AVR is powered on.
              </p>
              <Link to="/denon-avr-remote" className="farmhouse-btn farmhouse-btn-primary">
                Go to AVR Remote
              </Link>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>John's Remote</h2>

      {errorMessage && (
        <div
          className={`mb-4 p-4 rounded ${
            errorMessage.includes('successfully')
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {errorMessage}
        </div>
      )}

      <div className="flex justify-center mt-6">
        <div className="relative w-full bg-slate-900 rounded-3xl px-6 pt-6 pb-10 shadow-xl">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="text-white font-bold text-2xl tracking-wider">JOHN'S</div>
            <div className="text-gray-400 text-sm tracking-wide">REMOTE</div>
          </div>

          {/* Combined Status Display */}
          <div className="bg-slate-300 rounded-lg p-3 mb-6 text-center shadow-inner">
            <div className="font-bold text-lg mb-1">
              TV: {tvIsPoweredOn ? 'ON' : 'OFF'} | AVR: {avrIsPoweredOn ? 'ON' : 'OFF'}
            </div>
            <div className="text-sm">
              <div>
                <strong>TV Input:</strong> {tvCurrentInput.replace('_', ' ')}
              </div>
              <div>
                <strong>AVR Volume:</strong> {avrVolume} {avrIsMuted ? '(Muted)' : ''}
              </div>
              <div>
                <strong>AVR Input:</strong> {avrCurrentInput}
              </div>
              {tvCurrentInput === 'TV' && tvChannel && (
                <div>
                  <strong>Channel:</strong> {tvChannel}
                </div>
              )}
              {tvCurrentInput === 'SMARTCAST' && tvCurrentApp && tvCurrentApp !== 'Unknown' && (
                <div>
                  <strong>App:</strong> {tvCurrentApp}
                </div>
              )}
            </div>
          </div>

          {/* Power & All On Row */}
          <div className="flex justify-between mb-6">
            <ToggleButton
              variant="power"
              isActive={tvIsPoweredOn}
              onClick={() => handleTvCommand('POWER')}
              disabled={loading}
              title={tvIsPoweredOn ? 'Turn TV Off' : 'Turn TV On'}
            >
              <FaPowerOff />
            </ToggleButton>

            <Button
              className={`px-4 py-2 rounded-lg text-white shadow-md flex items-center justify-center ${
                loading || isAllOnDisabled
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              onClick={handleAllOn}
              disabled={loading || isAllOnDisabled}
              title={
                loading
                  ? 'Loading...'
                  : isAllOnDisabled
                    ? 'All devices are on and configured'
                    : 'Turn on both devices and set AVR to TV mode with volume 55'
              }
            >
              <FaAllOn className="mr-2" />
              All On
            </Button>

            <ToggleButton
              variant="mute"
              isActive={avrIsMuted}
              onClick={() => handleAvrCommand('MUTE_TOGGLE')}
              disabled={loading || !avrIsPoweredOn}
              title={avrIsMuted ? 'Unmute AVR Sound' : 'Mute AVR Sound'}
            >
              {avrIsMuted ? <FaVolumeOff /> : <FaVolumeMute />}
            </ToggleButton>
          </div>

          {/* Smart TV App Shortcuts */}
          <div className="mb-6">
            <div className="text-white mb-2 font-medium">Smart TV Apps</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                maxWidth: '200px',
                margin: '0 auto',
                justifyItems: 'center',
              }}
            >
              {VIZIO_TV_APPS.map(app => {
                const isAppActive = () => {
                  if (
                    !tvCurrentApp ||
                    tvCurrentApp === 'Unknown' ||
                    tvCurrentApp === 'No App Running'
                  ) {
                    return false;
                  }

                  if (tvCurrentApp === app.name) {
                    return true;
                  }

                  const normalizedCurrent = tvCurrentApp.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const normalizedApp = app.name.toLowerCase().replace(/[^a-z0-9]/g, '');

                  return normalizedCurrent === normalizedApp;
                };

                return (
                  <ToggleButton
                    key={app.id}
                    variant="input"
                    isActive={isAppActive()}
                    onClick={() => handleTvCommand(app.id)}
                    disabled={loading || !tvIsPoweredOn}
                    title={`Open ${app.displayName} App`}
                    className="h-14 w-14 flex items-center justify-center p-2"
                  >
                    {app.icon}
                  </ToggleButton>
                );
              })}
            </div>
          </div>

          {/* AVR Volume Control */}
          <VolumeBar
            volume={avrVolume}
            isMuted={avrIsMuted}
            onVolumeDown={() => handleAvrCommand('VOLUME_DOWN')}
            onVolumeUp={() => handleAvrCommand('VOLUME_UP')}
            onVolumeChange={handleAvrVolumeChange}
            disabled={loading || !avrIsPoweredOn}
            title="AVR Volume Control"
          />

          {/* Navigation D-Pad */}
          <div className="flex justify-center mb-6">
            <div
              style={{
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
                alignItems: 'center',
              }}
            >
              <Button
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleTvCommand('UP')}
                disabled={loading || !tvIsPoweredOn}
                style={{ gridArea: 'up' }}
                title="Navigate Up"
              >
                ▲
              </Button>

              <Button
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleTvCommand('LEFT')}
                disabled={loading || !tvIsPoweredOn}
                style={{ gridArea: 'left' }}
                title="Navigate Left"
              >
                ◀
              </Button>

              <Button
                className="w-14 h-14 rounded-full bg-slate-500 hover:bg-slate-600 text-white font-bold text-lg shadow-md"
                onClick={() => handleTvCommand('OK')}
                disabled={loading || !tvIsPoweredOn}
                style={{ gridArea: 'ok', width: '56px', height: '56px' }}
                title="Select/Confirm"
              >
                OK
              </Button>

              <Button
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleTvCommand('RIGHT')}
                disabled={loading || !tvIsPoweredOn}
                style={{ gridArea: 'right' }}
                title="Navigate Right"
              >
                ▶
              </Button>

              <Button
                className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white shadow-md"
                onClick={() => handleTvCommand('DOWN')}
                disabled={loading || !tvIsPoweredOn}
                style={{ gridArea: 'down' }}
                title="Navigate Down"
              >
                ▼
              </Button>
            </div>
          </div>

          {/* Menu Controls Row */}
          <div className="flex justify-between mb-6">
            <Button
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
              onClick={() => handleTvCommand('BACK')}
              disabled={loading || !tvIsPoweredOn}
              title="Go Back"
            >
              <FaArrowLeft />
            </Button>

            <Button
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
              onClick={() => handleTvCommand('HOME')}
              disabled={loading || !tvIsPoweredOn}
              title="Go to Home Screen"
            >
              <FaHome />
            </Button>

            <Button
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
              onClick={() => handleTvCommand('MENU')}
              disabled={loading || !tvIsPoweredOn}
              title="Open Menu"
            >
              <FaBars />
            </Button>

            <Button
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
              onClick={() => handleTvCommand('INFO')}
              disabled={loading || !tvIsPoweredOn}
              title="Show Program Info"
            >
              <FaInfoCircle />
            </Button>
          </div>

          {/* Number Pad */}
          <div className="mb-6">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                maxWidth: '20rem',
                margin: '0 auto',
              }}
            >
              {/* Row 1: 1, 2, 3 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '1')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 1"
              >
                1
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '2')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 2"
              >
                2
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '3')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 3"
              >
                3
              </Button>

              {/* Row 2: 4, 5, 6 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '4')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 4"
              >
                4
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '5')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 5"
              >
                5
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '6')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 6"
              >
                6
              </Button>

              {/* Row 3: 7, 8, 9 */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '7')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 7"
              >
                7
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '8')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 8"
              >
                8
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '9')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 9"
              >
                9
              </Button>

              {/* Row 4: EXIT, 0, GUIDE */}
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
                onClick={() => handleTvCommand('EXIT')}
                disabled={loading || !tvIsPoweredOn}
                title="Exit Current Screen"
              >
                <FaBackspace />
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-lg shadow-md"
                onClick={() => handleTvCommand('NUMBER', '0')}
                disabled={loading || !tvIsPoweredOn}
                title="Press Number 0"
              >
                0
              </Button>
              <Button
                className="h-14 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm shadow-md"
                onClick={() => handleTvCommand('GUIDE')}
                disabled={loading || !tvIsPoweredOn}
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
              onClick={() => handleTvCommand('REWIND')}
              disabled={loading || !tvIsPoweredOn}
              title="Rewind"
            >
              <FaFastBackward />
            </Button>

            <Button
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleTvCommand('PLAY')}
              disabled={loading || !tvIsPoweredOn}
              title="Play"
            >
              <FaPlay />
            </Button>

            <Button
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleTvCommand('PAUSE')}
              disabled={loading || !tvIsPoweredOn}
              title="Pause"
            >
              <FaPause />
            </Button>

            <Button
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleTvCommand('STOP')}
              disabled={loading || !tvIsPoweredOn}
              title="Stop"
            >
              <FaStop />
            </Button>

            <Button
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              onClick={() => handleTvCommand('FAST_FORWARD')}
              disabled={loading || !tvIsPoweredOn}
              title="Fast Forward"
            >
              <FaFastForward />
            </Button>
          </div>

          {/* Input Selection */}
          <div className="mb-4">
            <div className="text-white mb-2 font-medium">TV Input Selection</div>
            <div className="grid grid-cols-2 gap-2">
              {VIZIO_TV_INPUTS.map(input => (
                <ToggleButton
                  key={input.id}
                  variant="input"
                  isActive={tvCurrentInput === input.id}
                  onClick={() => handleTvCommand(`INPUT_${input.id}`)}
                  disabled={loading || !tvIsPoweredOn}
                  title={input.name}
                  className="h-12 flex-col text-xs"
                >
                  <span className="text-lg mb-1">{input.icon}</span>
                  <span className="truncate">{input.name}</span>
                </ToggleButton>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
