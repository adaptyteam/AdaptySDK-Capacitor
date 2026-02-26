import { Adapty } from './adapty';

export const adapty = new Adapty();
export * from './shared';
export type * from './logger';
export { consoleLogSink } from './logger';
export * from './shared/constants';
export { AdaptyError } from './shared/adapty-error';
export * from './types';
export type * from './types/configs';

export {
  createPaywallView,
  PaywallViewController,
  createOnboardingView,
  OnboardingViewController,
} from './ui-builder/index';
export type {
  CreatePaywallViewParamsInput,
  AdaptyCustomAsset,
  AdaptyUiView,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  AdaptyIOSPresentationStyle,
  EventHandlers,
  OnboardingEventHandlers,
} from './ui-builder/index';
export type { IdentifyParamsInput } from './types/inputs';
