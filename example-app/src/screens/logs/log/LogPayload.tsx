import React from 'react';
import { JsLog, dateFormat } from '../../../helpers';
import styles from './LogPayload.module.css';
import { useParams } from 'react-router-dom';
import { useLogs } from '../../../contexts/LogsContext.tsx';

interface LogPayloadProps {
  onBack: () => void;
}

function LogPayload({ onBack }: LogPayloadProps) {
  const { id } = useParams();
  const decodedId = id ? decodeURIComponent(id) : '';
  const { logs } = useLogs();
  const log = logs.find((l) => l.isoDate === decodedId) as JsLog | undefined;
  if (!log) return null;

  const renderValue = (value: any): React.ReactNode => {
    if (value === null) {
      return <span className={styles.NullValue}>null</span>;
    }
    if (value === undefined) {
      return <span className={styles.UndefinedValue}>undefined</span>;
    }
    if (typeof value === 'function') {
      try {
        const result = value();
        return (
          <div className={styles.FunctionValue}>
            <div className={styles.FunctionLabel}>function() → </div>
            <div className={styles.FunctionResult}>
              {renderValue(result)}
            </div>
          </div>
        );
      } catch (error) {
        return (
          <div className={styles.FunctionValue}>
            <div className={styles.FunctionLabel}>function() → </div>
            <div className={styles.FunctionError}>
              Error: {error instanceof Error ? error.message : String(error)}
            </div>
          </div>
        );
      }
    }
    if (typeof value === 'string') {
      return <span className={styles.StringValue}>"{value}"</span>;
    }
    if (typeof value === 'number') {
      return <span className={styles.NumberValue}>{value}</span>;
    }
    if (typeof value === 'boolean') {
      return <span className={styles.BooleanValue}>{value.toString()}</span>;
    }
    if (typeof value === 'object') {
      const serializedObject = JSON.stringify(value, (_key, val) => {
        if (typeof val === 'function') {
          return `[Function: ${val.name || 'anonymous'}]`;
        }
        return val;
      }, 2);

      return (
        <pre className={styles.ObjectValue}>
          {serializedObject}
        </pre>
      );
    }
    return String(value);
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'error': return styles.LogLevelError;
      case 'warn': return styles.LogLevelWarn;
      case 'info': return styles.LogLevelInfo;
      case 'debug': return styles.LogLevelDebug;
      case 'verbose': return styles.LogLevelVerbose;
      default: return '';
    }
  };

  return (
    <div className={styles.LogPayloadContainer}>
      <div className={styles.LogPayloadHeader}>
        <button className={styles.BackButton} onClick={onBack}>
          ← Back
        </button>
        <h2>Log Details</h2>
      </div>

      <div className={styles.LogPayloadContent}>
        <div className={styles.Section}>
          <h3>INFO</h3>
          <div className={styles.InfoGrid}>
            <div className={styles.InfoItem}>
              <span className={styles.InfoItemLabel}>Level:</span>
              <span className={`${styles.InfoItemValue} ${getLogLevelClass(log.logLevel)}`}>
                {log.logLevel}
              </span>
            </div>
            <div className={styles.InfoItem}>
              <span className={styles.InfoItemLabel}>DateTime:</span>
              <span className={styles.InfoItemValue}>
                {dateFormat(log.isoDate)}
              </span>
            </div>
            <div className={styles.InfoItem}>
              <span className={styles.InfoItemLabel}>Function:</span>
              <span className={styles.InfoItemValue}>{log.funcName}</span>
            </div>
            <div className={`${styles.InfoItem} ${styles.InfoItemFullWidth}`}>
              <span className={styles.InfoItemLabel}>Message:</span>
              <span className={styles.InfoItemValue}>{log.message}</span>
            </div>
          </div>
        </div>

        {log.args && log.args.length > 0 && (
          <div className={styles.Section}>
            <h3>Call arguments</h3>
            <div className={styles.ArgsList}>
              {log.args.map((arg, index) => (
                <div key={index} className={styles.ArgItem}>
                  <div className={styles.ArgHeader}>
                    <span className={styles.ArgIndex}>[{index}]</span>
                  </div>
                  <div className={styles.ArgValue}>
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
