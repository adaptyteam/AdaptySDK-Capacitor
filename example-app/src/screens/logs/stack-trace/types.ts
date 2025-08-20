export interface StackFrame {
  funcName: string;
  fileName: string;
  lineNum: number;
  colNum: number;
  fullLocation: string;
  isSdkCode: boolean;
  isReactCode: boolean;
}

export interface StackTraceProps {
  stackTrace: string;
  funcName: string;
  message: string;
  logLevel: string;
  timestamp: string;
}
