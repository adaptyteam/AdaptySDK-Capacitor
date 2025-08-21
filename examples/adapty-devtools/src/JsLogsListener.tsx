import { useEffect } from 'react';
import { adapty, consoleLogSink } from '@adapty/capacitor';
import type { JsLog } from './helpers';
import { createLog } from './helpers';
import { useLogs } from './contexts/LogsContext.tsx';
import type { LogEvent } from '@adapty/capacitor';

export default function JsLogsListener() {
  const { append } = useLogs();

  useEffect(() => {
    const memorySink = {
      id: 'devtools-memory',
      handle: (e: LogEvent) => {
        const log = createLog(
          e.level as JsLog['logLevel'],
          e.message,
          e.funcName,
          true, // isSDK
          e.params ?? {},
          new Date(e.timestamp).toISOString(),
        );

        append(log);
      },
    };

    adapty.setLogLevel({ logger: { sinks: [consoleLogSink, memorySink] } });

    return () => {
      adapty.setLogLevel({ logger: { sinks: undefined } });
    };
  }, [append]);

  return null;
}
