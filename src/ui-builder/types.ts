// import { AdaptyError } from '../adapty-error';
// import { AdaptyPaywallProduct, AdaptyProfile, AdaptyPurchaseResult } from '../types';
// import { FileLocation } from '../types/inputs'; // TODO: check if this type exists

/**
 * @internal
 */
export type ArgType<T> = T extends () => any ? void : T extends (arg: infer U) => any ? U : void;

/**
 * EventHandler callback should not return a promise,
 * because using `await` may postpone closing a paywall view.
 *
 * We don't want to block the UI thread.
 */
export type EventHandlerResult = boolean | void;

export type AdaptyUiOnboardingMeta = {
  onboardingId: string;
  screenClientId: string;
  screenIndex: number;
  totalScreens: number;
};

export type AdaptyUiOnboardingStateParams = {
  id: string;
  value: string;
  label: string;
};

/**
 * Paywall event handlers configuration
 *
 * @see {@link https://docs.adapty.io/docs/react-native-handling-events-1 | [DOC] Handling View Events}
 */
export interface EventHandlers {
  /**
   * Called when a user taps the close button on the paywall view
   *
   * If you return `true`, the paywall view will be closed.
   * We strongly recommend to return `true` in this case.
   * @default true
   */
  onCloseButtonPress: () => EventHandlerResult;
  /**
   * Called when a user navigates back on Android
   *
   * If you return `true`, the paywall view will be closed.
   * We strongly recommend to return `true` in this case.
   * @default true
   */
  onAndroidSystemBack: () => EventHandlerResult;
  /**
   * Called when a user taps an URL in the paywall view
   *
   * If you return `true`, the paywall view will be closed.
   * @default false
   */
  onUrlPress: (url: string) => EventHandlerResult;
  /**
   * Called when a user performs a custom action in the paywall view
   *
   * If you return `true`, the paywall view will be closed.
   * @default false
   */
  onCustomAction: (actionId: string) => EventHandlerResult;
  /**
   * Called when a user selects a product in the paywall view
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   */
  onProductSelected: (productId: string) => EventHandlerResult;
  /**
   * Called when a purchase process starts
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   */
  onPurchaseStarted: (product: any) => EventHandlerResult;
  /**
   * Called when the purchase succeeds, the user cancels their purchase, or the purchase appears to be pending
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * We strongly recommend returning `purchaseResult.type !== 'user_cancelled'` in this case.
   * @default `purchaseResult.type !== 'user_cancelled'`
   *
   * @param purchaseResult - object, which provides details about the purchase.
   * If the result is `'success'`, it also includes the updated user's profile.
   */
  onPurchaseCompleted: (purchaseResult: any, product: any) => EventHandlerResult;
  /**
   * Called if a purchase fails after a user taps the purchase button
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   *
   * @param error - AdaptyError object with error code and message
   */
  onPurchaseFailed: (error: any, product: any) => EventHandlerResult;
  /**
   * Called when a user taps the restore button in the paywall view
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   */
  onRestoreStarted: () => EventHandlerResult;
  /**
   * Called when a purchase is completed
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * We strongly recommend to return `true` in this case.
   * @default true
   *
   * @param profile - updated user profile
   */
  onRestoreCompleted: (profile: any) => EventHandlerResult;
  /**
   * Called if a restore fails after a user taps the restore button
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   *
   * @param error - AdaptyError object with error code and message
   */
  onRestoreFailed: (error: any) => EventHandlerResult;
  /**
   * Called when the paywall view appears
   *
   * If you return `true`, the paywall view will be closed.
   * @default false
   */
  onPaywallShown: () => EventHandlerResult;
  /**
   * Called when the paywall view disappears
   *
   * If you return `true`, the paywall view will be closed.
   * @default false
   */
  onPaywallClosed: () => EventHandlerResult;
  /**
   * Called if a paywall view fails to render.
   * This should not ever happen, but if it does, feel free to report it to us.
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   *
   * @param error - AdaptyError object with error code and message
   */
  onRenderingFailed: (error: any) => EventHandlerResult;
  /**
   * Called if a product list fails to load on a presented view,
   * for example, if there is no internet connection
   *
   * If you return `true` from this callback, the paywall view will be closed.
   * @default false
   *
   * @param error - AdaptyError object with error code and message
   */
  onLoadingProductsFailed: (error: any) => EventHandlerResult;
  /**
   * Called when web payment navigation finishes
   *
   * If you return `true`, the paywall view will be closed.
   * @default false
   */
  onWebPaymentNavigationFinished: (product: any, error: any) => EventHandlerResult;
}

/**
 * Default event handlers that provide standard closing behavior
 */
export const DEFAULT_EVENT_HANDLERS: EventHandlers = {
  onCloseButtonPress: () => true,
  onAndroidSystemBack: () => true,
  onUrlPress: (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
    return false;
  },
  onCustomAction: () => false,
  onProductSelected: () => false,
  onPurchaseStarted: () => false,
  onPurchaseCompleted: (purchaseResult: any) => purchaseResult?.type !== 'user_cancelled',
  onPurchaseFailed: () => false,
  onRestoreStarted: () => false,
  onRestoreCompleted: () => true,
  onRestoreFailed: () => false,
  onPaywallShown: () => false,
  onPaywallClosed: () => false,
  onRenderingFailed: () => false,
  onLoadingProductsFailed: () => false,
  onWebPaymentNavigationFinished: () => false,
};

export type OnboardingStateUpdatedAction =
  | {
      elementId: string;
      elementType: 'select';
      value: AdaptyUiOnboardingStateParams;
    }
  | {
      elementId: string;
      elementType: 'multi_select';
      value: AdaptyUiOnboardingStateParams[];
    }
  | {
      elementId: string;
      elementType: 'input';
      value: { type: 'text' | 'email'; value: string } | { type: 'number'; value: number };
    }
  | {
      elementId: string;
      elementType: 'date_picker';
      value: {
        day?: number;
        month?: number;
        year?: number;
      };
    };

export interface AdaptyUiView {
  id: string;
}

export interface AdaptyUiMediaCache {
  memoryStorageTotalCostLimit?: number;
  memoryStorageCountLimit?: number;
  diskStorageSizeLimit?: number;
}

export interface AdaptyUiDialogConfig {
  /**
   * The action title to display as part of the dialog. If you provide two actions,
   * be sure `primaryAction` cancels the operation and leaves things unchanged.
   */
  primaryActionTitle: string;
  /**
   * The secondary action title to display as part of the dialog.
   */
  secondaryActionTitle?: string;
  /**
   * The title of the dialog.
   */
  title?: string;
  /**
   * Descriptive text that provides additional details about the reason for the dialog.
   */
  content?: string;
}

export const AdaptyUiDialogActionType = Object.freeze({
  primary: 'primary',
  secondary: 'secondary',
});

export type AdaptyUiDialogActionType = (typeof AdaptyUiDialogActionType)[keyof typeof AdaptyUiDialogActionType];

/**
 * Additional options for creating a paywall view
 *
 * @see {@link https://docs.adapty.io/docs/paywall-builder-fetching | [DOC] Creating Paywall View}
 */
export interface CreatePaywallViewParamsInput {
  /**
   * `true` if you want to prefetch products before presenting a paywall view.
   */
  prefetchProducts?: boolean;
  /**
   * This value limits the timeout (in milliseconds) for this method.
   */
  loadTimeoutMs?: number;
  /**
   * If you are going to use custom tags functionality, pass an object with tags and corresponding replacement values
   *
   * ```
   * {
   *   'USERNAME': 'Bruce',
   *   'CITY': 'Philadelphia'
   * }
   * ```
   */
  customTags?: Record<string, string>;
  /**
   * If you are going to use custom timer functionality, pass an object with timer ids and corresponding dates the timers should end at
   */
  customTimers?: Record<string, Date>;

  // customAssets?: Record<string, AdaptyCustomAsset>; // TODO: implement custom assets
}

export interface OnboardingEventHandlers {
  onClose: (actionId: string, meta: AdaptyUiOnboardingMeta) => EventHandlerResult;
  onCustom: (actionId: string, meta: AdaptyUiOnboardingMeta) => EventHandlerResult;
  onPaywall: (actionId: string, meta: AdaptyUiOnboardingMeta) => EventHandlerResult;
  onStateUpdated: (action: OnboardingStateUpdatedAction, meta: AdaptyUiOnboardingMeta) => EventHandlerResult;
  onFinishedLoading: (meta: AdaptyUiOnboardingMeta) => EventHandlerResult;
  onAnalytics: (
    event: {
      name: string;
      element_id?: string;
      reply?: string;
    },
    meta: AdaptyUiOnboardingMeta,
  ) => EventHandlerResult;
  onError: (error: any) => EventHandlerResult;
}

export const DEFAULT_ONBOARDING_EVENT_HANDLERS: Partial<OnboardingEventHandlers> = {
  onClose: () => true,
};
