import { useEffect } from 'react';
import { adapty, consoleLogSink } from '@adapty/capacitor';
import type { JsLog } from './helpers';
import { createLog } from './helpers';
import { useLogs } from './contexts/LogsContext.tsx';
import type { LogEvent } from '@adapty/capacitor';


// Registers Adapty JS logger sinks: keep console + push logs into example store
export default function JsLogsListener() {
  const { append } = useLogs();

  useEffect(() => {

    const memorySink = {
      id: 'example-memory',
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

    // no cleanup needed; sinks remain for app lifetime
  }, [append]);

  return null;
}
