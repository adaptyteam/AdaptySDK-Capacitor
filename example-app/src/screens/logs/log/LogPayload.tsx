import React from 'react';
import { JsLog, dateFormat } from '../../../helpers.ts';
import './LogPayload.css';

interface LogPayloadProps {
  log: JsLog;
  onBack: () => void;
}

function LogPayload({ log, onBack }: LogPayloadProps) {
  const renderValue = (value: any): React.ReactNode => {
    if (value === null) {
      return <span className="null-value">null</span>;
    }
    if (value === undefined) {
      return <span className="undefined-value">undefined</span>;
    }
    if (typeof value === 'string') {
      return <span className="string-value">"{value}"</span>;
    }
    if (typeof value === 'number') {
      return <span className="number-value">{value}</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="boolean-value">{value.toString()}</span>;
    }
    if (typeof value === 'object') {
      return (
        <pre className="object-value">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  };

  return (
    <div className="log-payload-container">
      <div className="log-payload-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Logs
        </button>
        <h2>Log Details</h2>
      </div>

      <div className="log-payload-content">
        <div className="section">
          <h3>INFO</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Level:</span>
              <span className={`value log-level-${log.logLevel}`}>
                {log.logLevel}
              </span>
            </div>
            <div className="info-item">
              <span className="label">DateTime:</span>
              <span className="value">
                {dateFormat(log.isoDate)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Function:</span>
              <span className="value">{log.funcName}</span>
            </div>
            <div className="info-item full-width">
              <span className="label">Message:</span>
              <span className="value">{log.message}</span>
            </div>
          </div>
        </div>

        {log.args && log.args.length > 0 && (
          <div className="section">
            <h3>ARGS</h3>
            <div className="args-list">
              {log.args.map((arg, index) => (
                <div key={index} className="arg-item">
                  <div className="arg-header">
                    <span className="arg-index">[{index}]</span>
                  </div>
                  <div className="arg-value">
                    {renderValue(arg)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LogPayload;
