import React, { useState } from 'react';
import { AdaptyCapacitorPlugin } from '@adapty/capacitor';

const App: React.FC = () => {
  const [echoText, setEchoText] = useState('Hello World!');
  const [result, setResult] = useState<string>('');

  const testEcho = async () => {
    try {
      const response = await AdaptyCapacitorPlugin.echo({ value: echoText });
      setResult(`Echo result: ${response.value}`);
    } catch (error) {
      setResult(`Error: ${error}`);
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
          <label htmlFor="echoInput">Echo Text:</label>
          <br />
          <input 
            type="text" 
            id="echoInput" 
            value={echoText}
            onChange={(e) => setEchoText(e.target.value)}
            style={{ 
              padding: '8px', 
              marginTop: '5px',
              marginRight: '10px',
              width: '200px'
            }}
          />
          <button 
            onClick={testEcho}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Echo
          </button>
        </div>

        {result && (
          <div style={{
            padding: '10px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            {result}
          </div>
        )}
      </main>
    </div>
  );
};

export default App; 