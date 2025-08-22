import { adapty, consoleLogSink } from '@adapty/capacitor';
import type { LogEvent } from '@adapty/capacitor';
import type { JsLog } from '../helpers';
import { createLog } from '../helpers';
import { eventListenersManager } from './eventListeners';

class InitializationService {
  private isInitialized = false;

  async initialize(appendLog: (log: JsLog) => void, setProfile: (profile: any) => void): Promise<void> {
    if (this.isInitialized) {
      appendLog(createLog('warn', 'Adapty service already initialized', 'InitializationService.initialize', false));
      return;
    }

    try {
      this.setupLogging(appendLog);

      await eventListenersManager.setup(appendLog, setProfile);

      this.isInitialized = true;
      appendLog(
        createLog('info', 'Adapty service initialized successfully', 'InitializationService.initialize', false),
      );
    } catch (error) {
      const errorMessage = `Failed to initialize Adapty service: ${error}`;
      // Duplicate error logging to console.error in case internal logging is broken
      console.error(errorMessage);
      appendLog(createLog('error', errorMessage, 'InitializationService.initialize', false));
      throw error;
    }
  }

  private setupLogging(appendLog: (log: JsLog) => void): void {
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

        appendLog(log);
      },
    };

    adapty.setLogLevel({ logger: { sinks: [consoleLogSink, memorySink] } });
  }

  cleanup(): void {
    if (!this.isInitialized) {
      return;
    }
    eventListenersManager.cleanup();

    // Reset logging
    adapty.setLogLevel({ logger: { sinks: [consoleLogSink] } });

    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const initializationService = new InitializationService();
