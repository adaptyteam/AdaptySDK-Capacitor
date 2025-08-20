import React from 'react';
import { StackTraceProps } from './types';
import { parseStackTrace, showStackTraceInConsole } from './utils';
import StackFrame from './StackFrame';
import styles from './StackTrace.module.css';

const StackTrace: React.FC<StackTraceProps> = ({
  stackTrace,
  funcName,
  message,
  logLevel,
  timestamp
}) => {
  // TODO: add memo
  const parsedStack = parseStackTrace(stackTrace);

  const handleShowInConsole = () => {
    showStackTraceInConsole(stackTrace, funcName, message, logLevel, timestamp);
  };

  return (
    <div>
      <div className={styles.SectionHeader}>
        <h3>Stack Trace</h3>
        <button 
          className={styles.ConsoleButton}
          onClick={handleShowInConsole}
          title="Show in console with source maps"
        >
          Log trace in devtools
        </button>
      </div>
      <div className={styles.StackTraceContainer}>
        {parsedStack.map((frame, index) => (
          <StackFrame key={index} frame={frame} index={index} />
        ))}
      </div>
    </div>
  );
};

export default StackTrace;
