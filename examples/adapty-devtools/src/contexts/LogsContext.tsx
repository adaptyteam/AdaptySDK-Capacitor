import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { JsLog } from '../helpers.ts';

interface LogsContextValue {
  logs: JsLog[];
  append: (log: JsLog) => void;
  clear: () => void;
}

const LogsContext = createContext<LogsContextValue | null>(null);

const MAX_LOGS = 1000;

export function LogsProvider({ children }: PropsWithChildren): JSX.Element {
  const [logs, setLogs] = useState<JsLog[]>([]);
  // Mirror the log array onto window so the wvd CLI can read a full, structured tail
  // without navigating to /logs (rows only exist in the DOM on that route, and are
  // filtered there). See the drive-devtools-webview skill in .claude/skills/.
  useEffect(() => {
    (window as unknown as { __adaptyDevtoolsLogs?: JsLog[] }).__adaptyDevtoolsLogs = logs;
  }, [logs]);
  const append = useCallback((log: JsLog) => setLogs((prev) => prev.concat(log).slice(-MAX_LOGS)), []);
  const clear = useCallback(() => setLogs([]), []);
  const value = useMemo(() => ({ logs, append, clear }), [logs, append, clear]);
  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const logContext = useContext(LogsContext);
  if (!logContext) throw new Error('useLogs must be used within LogsProvider');
  return logContext;
}
