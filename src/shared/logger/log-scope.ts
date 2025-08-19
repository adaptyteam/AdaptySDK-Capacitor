import { ScopeArgs } from './log-context';

export type LogArgs = () => Record<string, any>;
type LogCallback = (LazyParams: LogArgs) => void;

interface LogScopeConstructor extends ScopeArgs {
  onStart: LogCallback;
  onSuccess: LogCallback;
  onFailed: LogCallback;
  onWait: LogCallback;
  onWaitComplete: LogCallback;
}

export class LogScope {
  public methodName: string;
  private onStart: LogCallback;
  private onSuccess: LogCallback;
  private onFailed: LogCallback;
  private onWait: LogCallback;
  private onWaitComplete: LogCallback;

  constructor(args: LogScopeConstructor) {
    this.methodName = args.methodName;
    this.onStart = args.onStart;
    this.onSuccess = args.onSuccess;
    this.onFailed = args.onFailed;
    this.onWait = args.onWait;
    this.onWaitComplete = args.onWaitComplete;
  }

  public start(args: LogArgs) {
    this.onStart(args);
  }
  public wait(args: LogArgs) {
    this.onWait(args);
  }
  public waitComplete(args: LogArgs) {
    this.onWaitComplete(args);
  }
  public success(args: LogArgs) {
    this.onSuccess(args);
  }
  public failed(args: LogArgs) {
    this.onFailed(args);
  }
}
