import { Adapty } from './adapty';

export const adapty = new Adapty();
export * from './shared';
export type * from './shared/logger';
export { consoleLogSink } from './shared/logger';
export * from './shared/constants';
export { AdaptyError } from './shared/adapty-error';
export * from './shared/types';
export type * from './types/configs';

export {
  createPaywallView,
  PaywallViewController,
  createOnboardingView,
  OnboardingViewController,
} from './ui-builder/index';
export type {
  CreatePaywallViewParamsInput,
  AdaptyUiView,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  EventHandlers,
  OnboardingEventHandlers,
} from './ui-builder/index';
