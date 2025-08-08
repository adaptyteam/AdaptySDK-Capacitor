import { useEffect } from 'react';
import { appendJsLog, JsLog } from './helpers';

// Listens to console.* and pushes Adapty-related logs into global store
export default function JsLogsListener() {
  useEffect(() => {
    type ConsoleKey = keyof typeof console;
    type Console = Record<ConsoleKey, any>;
    const consoleMethods: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

    const originalConsoleMethods = consoleMethods.reduce<Record<string, any>>((acc, method) => {
      acc[method] = console[method];
      return acc;
    }, {});

    const overrideConsoleMethod = (method: ConsoleKey): void => {
      (console as Console)[method] = (...args: any[]) => {
        originalConsoleMethods[method](...args);

        if (args[0] && typeof args[0] === 'string' && args[0].includes('[adapty')) {
          const msg = args[0].split(' ');
          const isoDate = msg[0]?.replace('[', '').replace(']', '') ?? new Date().toISOString();
          const funcName = msg[2]?.replace('"', '').replace('":', '') ?? 'unknown';
          const message = msg.slice(3).join(' ') || args.join(' ');

          appendJsLog({ logLevel: method as JsLog['logLevel'], message, isoDate, funcName, args });
        } else if (args[0] && typeof args[0] === 'string' && args[0].includes('[ADAPTY]')) {
          const timestamp = new Date().toISOString();
          const message = args.join(' ');
          const funcName = 'console';

          appendJsLog({ logLevel: method as JsLog['logLevel'], message, isoDate: timestamp, funcName, args });
        }
      };
    };

    ;['debug', 'info', 'warn', 'error'].forEach((m) => overrideConsoleMethod(m as ConsoleKey));

    return () => {
      ;['debug', 'info', 'warn', 'error'].forEach((m) => {
        (console as any)[m] = originalConsoleMethods[m];
      });
    };
  }, []);

  return null;
} 