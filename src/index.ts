export { adapty } from './adapty-instance';
export type * from './logger';
export { consoleLogSink } from './logger';
export { AdaptyError } from '@adapty/core';
export * from './types';
export type * from './types/configs';

export {
  createFlowView,
  FlowViewController,
  createOnboardingView,
  OnboardingViewController,
} from './ui-builder/index';
export type {
  CreateFlowViewParamsInput,
  AdaptyCustomAsset,
  AdaptyUiView,
  AdaptyUiDialogConfig,
  AdaptyIOSPresentationStyle,
  FlowEventHandlers,
  OnboardingEventHandlers,
  AdaptyPermission,
  FlowPermissionResponse,
  FlowPermissionStatus,
} from './ui-builder/index';
export { AdaptyUiDialogActionType } from './ui-builder/index';
export type { IdentifyParamsInput } from './types/inputs';
