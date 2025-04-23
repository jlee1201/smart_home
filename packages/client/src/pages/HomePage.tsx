import { Card } from '@design-system';

interface HomePageProps {
  message: string;
  currentInput: string;
}

export function HomePage({ message, currentInput }: HomePageProps) {
  return (
    <div>
      <h2>Welcome to your Smart Home</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 mt-8">
        <Card 
          title="Server Connection" 
          subtitle="Status information from the backend"
        >
          <p>
            Message from server: <span className="font-medium">{message}</span>
          </p>
        </Card>
        
        <Card 
          title="Current Input"
          subtitle="Real-time data input status"
        >
          <p>
            Current input value: <span className="font-medium">{currentInput || 'No input'}</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
