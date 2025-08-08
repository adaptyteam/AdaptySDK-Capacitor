import { useState, useEffect } from 'react';

// Constants for error messages
const ADAPTY_PREFIX = '[ADAPTY]';
const CREDENTIALS_FILE = '.adapty-credentials.json';
const CREDENTIALS_COMMAND = "Please run 'yarn run credentials' to generate the credentials file.";

import credentialsFile from '../.adapty-credentials.json';

const credentials: { token?: string; placement_id?: string; ios_bundle?: string } = credentialsFile;

// This function is only for this example
export function getApiKey(): string {
  if (!credentials?.token) {
    throw new Error(`${ADAPTY_PREFIX} Token not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.token;
}

// This function is only for this example
export function getPlacementId(): string {
  if (!credentials?.placement_id) {
    throw new Error(`${ADAPTY_PREFIX} Placement ID not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.placement_id;
}

// This function is only for this example
export function getIosBundle(): string {
  if (!credentials?.ios_bundle) {
    throw new Error(`${ADAPTY_PREFIX} iOS bundle not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.ios_bundle;
}

export interface JsLog {
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  message: string;
  funcName: string;
  args: any[];
  isoDate: string;
}

type ConsoleKey = keyof typeof console;
type Console = Record<ConsoleKey, any>;

const consoleMethods: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

// useJsLogs pipes JS logs to the state of the component
export function useJsLogs(): JsLog[] {
  const [logs, setLogs] = useState<JsLog[]>([]);

  useEffect(() => {
    // Store the original console methods
    const originalConsoleMethods = consoleMethods.reduce<Console>((acc, method) => {
      const methodKey = method as ConsoleKey;
      acc[methodKey] = console[methodKey];
      return acc;
    }, {} as Console);

    // Override console method
    const overrideConsoleMethod = (method: ConsoleKey): void => {
      (console as Console)[method] = (...args: any[]) => {
        // Call the original console method
        originalConsoleMethods[method](...args);

        // Append the new log to the state, if it is adapty related
        if (args[0] && typeof args[0] === 'string' && args[0].includes('[adapty')) {
          const msg = args[0].split(' ');
          // msg format `[${now}] [adapty@${version}] "${funcName}": ${message}`;
          // extract isoDate, funcName, message
          const isoDate = msg[0].replace('[', '').replace(']', '');
          const funcName = msg[2].replace('"', '').replace('":', '');
          const message = msg.slice(3).join(' ');

          setLogs((prevLogs) => [...prevLogs, { logLevel: method as any, message, isoDate, funcName, args }]);
        } else if (args[0] && typeof args[0] === 'string' && args[0].includes('[ADAPTY]')) {
          // Also capture our custom [ADAPTY] logs
          const timestamp = new Date().toISOString();
          const message = args.join(' ');
          const funcName = 'console';

          setLogs((prevLogs) => [
            ...prevLogs,
            { logLevel: method as any, message, isoDate: timestamp, funcName, args },
          ]);
        }
      };
    };

    // Apply the override to all console methods
    consoleMethods.forEach(overrideConsoleMethod);

    // Restore the original console methods when the component is unmounted
    return () => {
      consoleMethods.forEach((method) => {
        console[method] = originalConsoleMethods[method];
      });
    };
  }, []);

  return logs;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString() + '.' + d.getMilliseconds().toString().padStart(3, '0');
}

export function dateFormat(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString() + ', ' + d.toLocaleTimeString();
}
