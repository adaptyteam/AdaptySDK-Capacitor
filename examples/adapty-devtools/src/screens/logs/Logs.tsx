import { useCallback, useMemo, useState } from 'react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { JsLog, formatDate, getFuncNameColor, getLogLevelColor } from '../../helpers';
import styles from './Logs.module.css';
import { elementIds } from '../../elementIds';

interface LogsProps {
  logs: JsLog[];
  onLogClick: (log: JsLog) => void;
  onClearLogs: () => void;
}

type LogFilter = 'sdk' | 'app' | 'all';

function Logs({ logs, onLogClick, onClearLogs }: LogsProps) {
  const [filter, setFilter] = useState<LogFilter>('sdk');

  const filteredLogs = useMemo(() => {
    switch (filter) {
      case 'sdk':
        return logs.filter((log) => log.isSDK);
      case 'app':
        return logs.filter((log) => !log.isSDK);
      case 'all':
      default:
        return logs;
    }
  }, [logs, filter]);

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
          <div id={elementIds.logs.countValue} className={styles.LogsSubheader}>
            {filteredLogs.length} logs (Newest first)
          </div>
        </div>
        <div className={styles.LogsControls}>
          <div className={styles.FilterButtons}>
            <button
              id={elementIds.logs.filterSdkBtn}
              className={`${styles.FilterButton} ${filter === 'sdk' ? styles.FilterButtonActive : ''}`}
              onClick={() => setFilter('sdk')}
            >
              SDK
            </button>
            <button
              id={elementIds.logs.filterAppBtn}
              className={`${styles.FilterButton} ${filter === 'app' ? styles.FilterButtonActive : ''}`}
              onClick={() => setFilter('app')}
            >
              App
            </button>
            <button
              id={elementIds.logs.filterAllBtn}
              className={`${styles.FilterButton} ${filter === 'all' ? styles.FilterButtonActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
          </div>
          <button id={elementIds.logs.exportBtn} className={styles.ExportButton} onClick={exportAsJson}>
            Export
          </button>
          <button id={elementIds.logs.clearBtn} className={styles.ClearButton} onClick={onClearLogs}>
            Clear
          </button>
        </div>
      </div>
      <div className={styles.LogsList}>
        {filteredLogs
          .slice()
          .reverse()
          .map((log, index) => (
            <LogLine
              key={log.id}
              id={elementIds.logs.item(log.id)}
              log={log}
              onClick={() => onLogClick(log)}
              isFirst={index === 0}
              isLast={index === filteredLogs.length - 1}
            />
          ))}
      </div>
    </div>
  );
}

interface LogLineProps {
  id: string;
  log: JsLog;
  isFirst?: boolean;
  isLast?: boolean;
  onClick?: () => void;
}

function LogLine({ id, log, isFirst, isLast, onClick }: LogLineProps) {
  const borderStyle = useMemo(
    () => ({
      borderLeft: `6px solid ${getFuncNameColor(log.funcName)}`,
    }),
    [log.funcName],
  );

  return (
    <div
      id={id}
      className={`${styles.LogLine} ${isFirst ? styles.LogLineFirst : ''} ${isLast ? styles.LogLineLast : ''}`}
      onClick={onClick}
      style={borderStyle}
    >
      <div className={styles.LogContent}>
        <div className={styles.LogIcon}>
          <div className={styles.LogLevelIndicator} style={{ backgroundColor: getLogLevelColor(log.logLevel) }} />
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
