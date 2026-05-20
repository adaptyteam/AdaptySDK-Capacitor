import type { AdaptyPurchaseResult, EventHandlers, OnboardingEventHandlers, WebPresentation } from '@adapty/core';

import { Log } from '../logger';

// Re-export all shared UI types from @adapty/core
export type {
  EventHandlerResult,
  ProductPurchaseParams,
  EventHandlers,
  OnboardingEventHandlers,
  OnboardingAnalyticsEventName,
  AdaptyUiOnboardingMeta,
  AdaptyUiOnboardingStateParams,
  OnboardingStateUpdatedAction,
  CreatePaywallViewParamsInput,
  CreateOnboardingViewParamsInput,
  AdaptyUiView,
  AdaptyUiMediaCache,
  AdaptyUiDialogConfig,
  AdaptyCustomAsset,
  AdaptyCustomImageAsset,
  AdaptyCustomVideoAsset,
  AdaptyCustomColorAsset,
  AdaptyCustomGradientAsset,
  AdaptyIOSPresentationStyle,
} from '@adapty/core';

export { AdaptyUiDialogActionType } from '@adapty/core';

/**
 * Default event handlers that provide standard closing behavior.
 *
 * The default onUrlPress handler does not support `browser_in_app`.
 * To support it, install an in-app browser plugin (e.g. `@capacitor/inappbrowser`)
 * and handle the `openIn` argument in your own custom onUrlPress handler.
 */
export const DEFAULT_EVENT_HANDLERS: EventHandlers = {
  onCloseButtonPress: () => true,
  onAndroidSystemBack: () => true,
  onUrlPress: (url: string, openIn: WebPresentation) => {
    if (openIn === 'browser_in_app') {
      Log.warn(
        'onUrlPress',
        () =>
          'open_in=browser_in_app is not supported by the default onUrlPress handler. Override onUrlPress to support an in-app browser.',
      );
    }
    if (typeof window !== 'undefined') {
      try {
        window.open(new URL(url), '_blank');
      } catch {
        Log.warn('onUrlPress', () => `Invalid URL: ${url}`);
      }
    }
    return false;
  },
  onCustomAction: () => false,
  onProductSelected: () => false,
  onPurchaseStarted: () => false,
  onPurchaseCompleted: (purchaseResult: AdaptyPurchaseResult) => purchaseResult?.type !== 'user_cancelled',
  onPurchaseFailed: () => false,
  onRestoreStarted: () => false,
  onRestoreCompleted: () => true,
  onRestoreFailed: () => false,
  onAppeared: () => false,
  onDisappeared: () => false,
  onRenderingFailed: () => true,
  onLoadingProductsFailed: () => false,
  onWebPaymentNavigationFinished: () => false,
};

export const DEFAULT_ONBOARDING_EVENT_HANDLERS: Partial<OnboardingEventHandlers> = {
  onClose: () => true,
};
