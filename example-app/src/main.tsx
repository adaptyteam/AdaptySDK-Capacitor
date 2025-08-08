import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './screens/app/App';
import Logs from './screens/logs/Logs';
import LogPayload from './screens/logs/LogPayload';
import { useJsLogs, JsLog } from './helpers';

type Screen = 'app' | 'logs' | 'logPayload';

function MainApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('app');
  const [selectedLog, setSelectedLog] = useState<JsLog | null>(null);
  const logs = useJsLogs();

  const navigateToLogs = () => {
    setCurrentScreen('logs');
  };

  const navigateToLogPayload = (log: JsLog) => {
    setSelectedLog(log);
    setCurrentScreen('logPayload');
  };

  const navigateToApp = () => {
    setCurrentScreen('app');
    setSelectedLog(null);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'logs':
        return (
          <Logs 
            logs={logs} 
            onLogClick={navigateToLogPayload}
            onBack={navigateToApp}
          />
        );
      case 'logPayload':
        return selectedLog ? (
          <LogPayload 
            log={selectedLog} 
            onBack={() => setCurrentScreen('logs')}
          />
        ) : null;
      case 'app':
      default:
        return <App onNavigateToLogs={navigateToLogs} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}>
      {renderScreen()}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
); 
