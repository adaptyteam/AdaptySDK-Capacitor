import React from 'react';
import { JsLog, formatDate } from '../../helpers';
import './Logs.css';

interface LogsProps {
  logs: JsLog[];
  onLogClick: (log: JsLog) => void;
  onBack: () => void;
}

function Logs({ logs, onLogClick, onBack }: LogsProps) {
  return (
    <div className="logs-container">
      <div className="logs-header">
        <div className="logs-header-content">
          <button 
            className="back-button-ios" 
            onClick={onBack}
            title="Back to App"
          >
            ← Back
          </button>
          <h2>{logs.length} logs (Newest first)</h2>
        </div>
      </div>
      <div className="logs-list">
        {logs.slice().reverse().map((log, index) => (
          <LogLine
            key={index}
            log={log}
            onClick={() => onLogClick(log)}
            isFirst={index === 0}
            isLast={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

interface LogLineProps {
  log: JsLog;
  isFirst?: boolean;
  isLast?: boolean;
  onClick?: () => void;
}

function LogLine({ log, isFirst, isLast, onClick }: LogLineProps) {
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      case 'info': return '#4777ff';
      case 'debug': return '#888888';
      case 'verbose': return '#666666';
      default: return '#000000';
    }
  };

  return (
    <div 
      className={`log-line ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}`}
      onClick={onClick}
    >
      <div className="log-content">
        <div className="log-icon">
          <div 
            className="log-level-indicator"
            style={{ backgroundColor: getLogLevelColor(log.logLevel) }}
          />
        </div>
        <div className="log-body">
          <div className="log-header">
            <span className="func-name">{log.funcName}</span>
            <span className="timestamp">{formatDate(log.isoDate)}</span>
          </div>
          <div className="log-message">{log.message}</div>
        </div>
      </div>
    </div>
  );
}

export default Logs; 