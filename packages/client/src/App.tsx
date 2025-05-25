import { Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { VizioRemotePage } from '@/pages/VizioRemotePage';
import { TVPairingPage } from '@/pages/TVPairingPage';
import { DenonAvrRemotePage } from '@/pages/DenonAvrRemotePage';
import { Layout } from '@design-system';
import { ErrorLog } from '@/components/ErrorLog';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route 
          path="/" 
          element={<HomePage />} 
        />
        <Route path="/vizio-remote" element={<VizioRemotePage />} />
        <Route path="/tv-pairing" element={<TVPairingPage />} />
        <Route path="/denon-avr-remote" element={<DenonAvrRemotePage />} />
      </Routes>
      
      {/* Error Log component */}
      <ErrorLog />
    </Layout>
  );
}