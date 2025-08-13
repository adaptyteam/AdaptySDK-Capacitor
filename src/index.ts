import { Adapty } from './adapty';

export const adapty = new Adapty();
export type * from './shared';
export type * from './shared/logger';
export { consoleLogSink } from './shared/logger';
export * from './shared/constants';
export type * from './types/configs';

export { createPaywallView, PaywallViewController } from './ui-builder/index';
export type {
  CreatePaywallViewParamsInput,
  AdaptyUiView,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  EventHandlers,
} from './ui-builder/index';
