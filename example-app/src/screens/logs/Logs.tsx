import { useCallback, useMemo } from 'react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { JsLog, formatDate, getFuncNameColor, getLogLevelColor } from '../../helpers';
import styles from './Logs.module.css';


interface LogsProps {
  logs: JsLog[];
  onLogClick: (log: JsLog) => void;
}

function Logs({ logs, onLogClick }: LogsProps) {
  const exportAsJson = useCallback(async () => {
    const pretty = JSON.stringify(logs, null, 2);
    const fileName = `adapty-capacitor-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    try {
      const writeRes = await Filesystem.writeFile({
        path: fileName,
        data: pretty,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      // Resolve shareable URI (especially for Android content://)
      let fileUri: string | undefined = writeRes.uri as unknown as string | undefined;
      try {
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        if (uri) fileUri = uri;
      } catch {}

      await Share.share({
        title: 'Adapty Logs',
        url: fileUri,
        dialogTitle: 'Share logs JSON',
      });
    } catch (err) {
      alert('Failed to export logs.');
    }
  }, [logs]);

  return (
    <div className={styles.LogsContainer}>
      <div className={styles.LogsHeader}>
        <div className={styles.LogsHeaderContent}>
          <h2>Logs</h2>
          <div className={styles.LogsSubheader}>
            {logs.length} logs (Newest first)
          </div>
        </div>
        <button className={styles.ExportButton} onClick={exportAsJson}>
          Export JSON
        </button>
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
  const borderStyle = useMemo(() => ({
    borderLeft: `6px solid ${getFuncNameColor(log.funcName)}`
  }), [log.funcName]);

  return (
    <div
      className={`${styles.LogLine} ${isFirst ? styles.LogLineFirst : ''} ${isLast ? styles.LogLineLast : ''}`}
      onClick={onClick}
      style={borderStyle}
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
