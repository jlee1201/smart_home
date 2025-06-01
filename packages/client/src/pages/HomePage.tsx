import { Card } from '@design-system';
import { Link } from 'react-router-dom';
import { gql, useQuery } from '@apollo/client';

const TV_CONNECTION_STATUS_QUERY = gql`
  query GetTVConnectionStatus {
    tvConnectionStatus {
      connected
    }
  }
`;

const DENON_AVR_CONNECTION_STATUS_QUERY = gql`
  query GetDenonAvrConnectionStatus {
    denonAvrConnectionStatus {
      connected
    }
  }
`;

export function HomePage() {
  const { data: tvConnectionData } = useQuery(TV_CONNECTION_STATUS_QUERY);
  const { data: denonAvrConnectionData } = useQuery(DENON_AVR_CONNECTION_STATUS_QUERY);
  
  const isTVConnected = tvConnectionData?.tvConnectionStatus?.connected === true;
  const isDenonAvrConnected = denonAvrConnectionData?.denonAvrConnectionStatus?.connected === true;
  
  return (
    <div>
      <h2>Welcome to your Smart Home</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card
          title="Vizio TV Status"
          subtitle="TV connection status"
        >
          <p className="mb-4">
            Status: <span className={`font-medium ${isTVConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isTVConnected ? 'Connected' : 'Not Connected'}
            </span>
          </p>
          
          {isTVConnected ? (
            <Link to="/vizio-remote" className="farmhouse-btn farmhouse-btn-primary">
              Open TV Remote
            </Link>
          ) : (
            <Link to="/tv-pairing" className="farmhouse-btn farmhouse-btn-primary">
              Set Up TV Connection
            </Link>
          )}
        </Card>

        <Card
          title="Denon AVR Status"
          subtitle="AV Receiver connection status"
        >
          <p className="mb-4">
            Status: <span className={`font-medium ${isDenonAvrConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isDenonAvrConnected ? 'Connected' : 'Not Connected'}
            </span>
          </p>
          
          <Link to="/denon-avr-remote" className="farmhouse-btn farmhouse-btn-primary">
            Open AVR Remote
          </Link>
        </Card>
        
        <Card
          title="John's Remote"
          subtitle="Combined TV & AVR control"
        >
          <p className="mb-4">
            Combined remote with TV controls and AVR volume. Includes sync functionality.
          </p>
          <p className="mb-4 text-sm text-gray-600">
            Status: TV {isTVConnected ? '✓' : '✗'} | AVR {isDenonAvrConnected ? '✓' : '✗'}
          </p>
          
          <Link to="/johns-remote" className="farmhouse-btn farmhouse-btn-primary">
            Open John's Remote
          </Link>
        </Card>
      </div>
    </div>
  );
}
