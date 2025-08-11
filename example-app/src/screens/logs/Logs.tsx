import { JsLog, formatDate } from '../../helpers';
import styles from './Logs.module.css';

interface LogsProps {
  logs: JsLog[];
  onLogClick: (log: JsLog) => void;
}

function Logs({ logs, onLogClick }: LogsProps) {
  return (
    <div className={styles.LogsContainer}>
      <div className={styles.LogsHeader}>
        <div className={styles.LogsHeaderContent}>
          <h2>{logs.length} logs (Newest first)</h2>
        </div>
      </div>
      <div className={styles.LogsList}>
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
      className={`${styles.LogLine} ${isFirst ? styles.LogLineFirst : ''} ${isLast ? styles.LogLineLast : ''}`}
      onClick={onClick}
    >
      <div className={styles.LogContent}>
        <div className={styles.LogIcon}>
          <div
            className={styles.LogLevelIndicator}
            style={{ backgroundColor: getLogLevelColor(log.logLevel) }}
          />
        </div>
        <div className={styles.LogBody}>
          <div className={styles.LogHeader}>
            <span className={styles.FuncName}>{log.funcName}</span>
            <span className={styles.Timestamp}>{formatDate(log.isoDate)}</span>
          </div>
          <div className={styles.LogMessage}>{log.message}</div>
        </div>
      </div>
    </div>
  );
}

export default Logs; 