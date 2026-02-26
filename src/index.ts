import { Adapty } from './adapty';

export const adapty = new Adapty();
export type * from './logger';
export { consoleLogSink } from './logger';
export * from './types/constants';
export { AdaptyError } from './types/adapty-error';
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
