import { LogLevel } from '../types/inputs';
import type { LogEvent, LogSink, LoggerConfig } from './types';
import { consoleLogSink } from './console-sink';

import VERSION from '../../version';

// Type for lazy evaluation functions
type LazyMessage = () => string;
type LazyParams = () => Record<string, any>;

export class Log {
  public static logLevel: LogLevel | null = null;
  private static sinks: LogSink[] = [consoleLogSink];
  private static defaultMeta?: LoggerConfig['defaultMeta'];

  // Formats a message for logging
  private static formatMessage(message: string, funcName: string): string {
    const now = new Date().toISOString();
    const version = VERSION;

    return `[${now}] [adapty@${version}] "${funcName}": ${message}`;
  }


  /** Configure JS logger: replace sinks and/or set default metadata */
  public static configure(config: LoggerConfig): void {
    if (config.sinks) {
      for (const sink of this.sinks) sink.destroy?.();
      this.sinks = config.sinks.slice();
    }
    this.defaultMeta = config.defaultMeta;
  }

  /** Register additional sink */
  public static addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  /** Remove sink by id and call its destroy if present */
  public static removeSink(id: string): void {
    const sink = this.sinks.find(sink => sink.id === id);
    this.sinks = this.sinks.filter(sink => sink.id !== id);
    sink?.destroy?.();
  }

  /** Clear all sinks and destroy them */
  public static clearSinks(): void {
    const prev = this.sinks;
    this.sinks = [];
    for (const sink of prev) sink.destroy?.();
  }

  /**
   * Gets the appropriate log level integer for a log level.
   * @internal
   */
  private static getLogLevelInt(logLevel: LogLevel): number {
    switch (logLevel) {
      case LogLevel.ERROR:
        return 0;
      case LogLevel.WARN:
        return 1;
      case LogLevel.INFO:
        return 2;
      case LogLevel.VERBOSE:
        return 3;
    }
  }

  /**
   * Logs a message to the console if the log level is appropriate.
   * Uses lazy evaluation to avoid unnecessary computations.
   * @internal
   */
  public static log(
    logLevel: LogLevel,
    funcName: string,
    message: LazyMessage,
    params?: LazyParams,
  ): void {
    if (!Log.logLevel) {
      return;
    }

    const currentLevel = Log.getLogLevelInt(Log.logLevel);
    const messageLevel = Log.getLogLevelInt(logLevel);

    if (messageLevel <= currentLevel) {
      // Lazy evaluation: only compute once per entry
      const resolvedMessage = message();
      const resolvedParams = params ? params() : undefined;
      const mergedParams =
        this.defaultMeta
          ? { ...(this.defaultMeta as Record<string, unknown>), ...(resolvedParams ?? {}) }
          : resolvedParams;

      const formatted = Log.formatMessage(resolvedMessage, funcName);
      const event: LogEvent = {
        timestamp: new Date().toISOString(),
        version: String(VERSION),
        level: logLevel,
        funcName,
        message: resolvedMessage,
        params: mergedParams,
        formatted,
      };

      for (const sink of this.sinks) {
        if (sink.levels && !sink.levels.includes(logLevel)) continue;
        try {
          sink.handle(event);
        } catch {
          // ignore sink errors
        }
      }
    }
  }

  public static info(
    funcName: string,
    message: LazyMessage,
    params?: LazyParams,
  ): void {
    this.log(LogLevel.INFO, funcName, message, params);
  }

  public static warn(
    funcName: string,
    message: LazyMessage,
    params?: LazyParams,
  ): void {
    this.log(LogLevel.WARN, funcName, message, params);
  }

  public static error(
    funcName: string,
    message: LazyMessage,
    params?: LazyParams,
  ): void {
    this.log(LogLevel.ERROR, funcName, message, params);
  }

  public static verbose(
    funcName: string,
    message: LazyMessage,
    params?: LazyParams,
  ): void {
    this.log(LogLevel.VERBOSE, funcName, message, params);
  }
}
