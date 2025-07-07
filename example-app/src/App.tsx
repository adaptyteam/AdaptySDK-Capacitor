import React, { useState, useEffect } from 'react';
import { Adapty } from '@adapty/capacitor';
import credentials from '../.adapty-credentials.json';

const App: React.FC = () => {
  const [echoText, setEchoText] = useState('Hello World!');
  const [result, setResult] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [isActivated, setIsActivated] = useState(false);

  const adapty = new Adapty();

  useEffect(() => {
    // Load API key from credentials file
    if (credentials.token) {
      setApiKey(credentials.token);
      setResult('API key loaded from credentials file');
    } else {
      setResult('No API key found in credentials file. Please run "npm run credentials" first.');
    }
  }, []);

  const testActivate = async () => {
    try {
      setResult('Activating Adapty...');
      await adapty.activate({
        apiKey: apiKey,
        params: {
          logLevel: 'verbose',
          observerMode: false,
        }
      });
      setResult('Adapty activated successfully!');
      setIsActivated(true);
    } catch (error) {
      setResult(`Activation Error: ${error}`);
      setIsActivated(false);
    }
  };

  const testIsActivated = async () => {
    try {
      const response = await adapty.isActivated();
      setResult(`Is Activated: ${response.isActivated}`);
      setIsActivated(response.isActivated);
    } catch (error) {
      setResult(`Error checking activation: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <main>
        <h1>Adapty Capacitor Plugin Test</h1>
        <p>
          This project can be used to test out the functionality of Adapty plugin. 
          Nothing in the <em>example-app/</em> folder will be published to npm.
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="apiKeyInput">API Key:</label>
          <br />
          <input 
            type="text" 
            id="apiKeyInput" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key will be loaded from credentials file"
            style={{ 
              padding: '8px', 
              marginTop: '5px',
              marginRight: '10px',
              width: '400px'
            }}
          />
          <button 
            onClick={testActivate}
            disabled={!apiKey || apiKey.trim().length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: isActivated ? '#28a745' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: (!apiKey || apiKey.trim().length === 0) ? 0.5 : 1
            }}
          >
            {isActivated ? 'Activated' : 'Activate Adapty'}
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={testIsActivated}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Check Activation Status
          </button>
        </div>

        {result && (
          <div style={{
            padding: '10px',
            backgroundColor: isActivated ? '#d4edda' : '#f8f9fa',
            border: `1px solid ${isActivated ? '#c3e6cb' : '#dee2e6'}`,
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            {result}
          </div>
        )}

        <div style={{ marginTop: '30px', fontSize: '14px', color: '#6c757d' }}>
          <h3>Instructions:</h3>
          <ol>
            <li>Run <code>npm run credentials</code> to set up your API key (already done if you see a key above)</li>
            <li>Click "Activate Adapty" to initialize the SDK</li>
            <li>Use "Check Activation Status" to verify the SDK is properly activated</li>
            <li>The Android implementation should work on Android devices/emulators</li>
          </ol>
          
          <h3>Current Configuration:</h3>
          <ul>
            <li>API Key: {apiKey ? `${apiKey.substring(0, 20)}...` : 'Not loaded'}</li>
            <li>Bundle ID: {credentials.ios_bundle || 'Not set'}</li>
            <li>Status: {isActivated ? 'Activated' : 'Not activated'}</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default App; 