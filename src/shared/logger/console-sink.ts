import type { LogSink } from './types';
import type { LogLevel } from '../types/inputs';

function getConsoleForLevel(level: LogLevel): (message?: any, ...optionalParams: any[]) => void {
  /* eslint-disable no-console */
  switch (level) {
    case 'error':
      return console.error;
    case 'warn':
      return console.warn;
    case 'verbose':
      return console.debug;
    case 'info':
    default:
      return console.info;
  }
  /* eslint-enable no-console */
}

export const consoleLogSink: LogSink = {
  id: 'console',
  handle: (event) => {
    const logger = getConsoleForLevel(event.level);
    logger(event.formatted, event.params);
  },
};


