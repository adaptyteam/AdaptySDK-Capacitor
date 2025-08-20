import React, { useMemo } from 'react';
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
  const parsedStack = useMemo(() => parseStackTrace(stackTrace), [stackTrace]);

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

      <div className={styles.ColorLegend}>
        <div className={styles.LegendTitle}>Color Guide:</div>
        <div className={styles.LegendItems}>
          <div className={styles.LegendItem}>
            <span className={`${styles.LegendColor} ${styles.SdkCode}`}>●</span>
            <span className={styles.LegendText}>Adapty SDK code</span>
          </div>
          <div className={styles.LegendItem}>
            <span className={`${styles.LegendColor} ${styles.AppCode}`}>●</span>
            <span className={styles.LegendText}>Devtools app code</span>
          </div>
          <div className={styles.LegendItem}>
            <span className={`${styles.LegendColor} ${styles.ReactCode}`}>●</span>
            <span className={styles.LegendText}>React/Framework code</span>
          </div>
        </div>
        <div className={styles.LegendNote}>
          Note: "Log trace in devtools" button outputs optimized for Chrome DevTools console with source map support
        </div>
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
