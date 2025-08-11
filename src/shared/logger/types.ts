import type { LogLevel } from '../types/inputs';

export interface LogEvent {
  timestamp: string;
  version: string;
  level: LogLevel;
  funcName: string;
  message: string;
  params?: Record<string, any>;
  formatted: string;
}

export interface LogSink {
  id: string;
  levels?: LogLevel[];
  handle: (event: LogEvent) => void;
  destroy?: () => void;
}

export interface LoggerConfig {
  sinks?: LogSink[];
  defaultMeta?: Record<string, unknown>;
}


