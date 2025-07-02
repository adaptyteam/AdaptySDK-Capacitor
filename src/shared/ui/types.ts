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
