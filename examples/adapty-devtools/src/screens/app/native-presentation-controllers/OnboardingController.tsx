import { forwardRef, useImperativeHandle } from 'react';
import { createOnboardingView, AdaptyError, WebPresentation } from '@adapty/capacitor';

export type OnboardingControllerRef = {
  presentOnboarding: () => Promise<void>;
};

type Props = {
  onboarding: any | null;
  externalUrlsPresentation: WebPresentation;
  canShowPaywall: () => boolean;
  showPaywall?: () => Promise<void> | void;
  setResult: (value: string) => void;
  log: (
    level: 'info' | 'error' | 'warn',
    message: string,
    funcName: string,
    isSDK?: boolean,
    params?: Record<string, any>,
  ) => void;
};

export const OnboardingController = forwardRef<OnboardingControllerRef, Props>(function OnboardingController(
  { onboarding, externalUrlsPresentation, canShowPaywall, showPaywall, setResult, log }: Props,
  ref,
) {
  const presentOnboarding = async () => {
    if (!onboarding) {
      setResult('❌ No onboarding loaded. Please load onboarding first.');
      return;
    }

    if (!onboarding.hasViewConfiguration) {
      setResult('❌ Onboarding does not have view configuration (no Onboarding Builder).');
      return;
    }

    try {
      setResult('Creating onboarding view...');

      const view = await createOnboardingView(onboarding, { externalUrlsPresentation });

      await view.setEventHandlers({
        onClose: (actionId: any, meta: any) => {
          log('info', 'Onboarding closed', 'onboarding.onClose', false, { actionId, meta });
          setResult('👋 Onboarding closed');
          return true;
        },
        onFinishedLoading: (meta: any) => {
          log('info', 'Onboarding finished loading', 'onboarding.onFinishedLoading', false, { meta });
          return false;
        },
        onCustom: (actionId: any, meta: any) => {
          log('info', 'Onboarding custom action', 'onboarding.onCustom', false, { actionId, meta });
          return false;
        },
        onPaywall: (actionId: any, meta: any) => {
          log('info', 'Onboarding paywall action', 'onboarding.onPaywall', false, { actionId, meta });

          if (!canShowPaywall()) {
            setResult('❌ Cannot show paywall: load paywall first (and ensure it has view configuration).');
            return false;
          }

          // RN-like behavior: close onboarding modal first, then present paywall
          view.dismiss().then(() => {
            showPaywall?.();
          });

          return false;
        },
        onAnalytics: (event: any, meta: any) => {
          log('info', 'Onboarding analytics', 'onboarding.onAnalytics', false, { event, meta });
          return false;
        },
        onStateUpdated: (action: any, meta: any) => {
          log('info', 'Onboarding state updated', 'onboarding.onStateUpdated', false, { action, meta });
          return false;
        },
        onError: (error: any) => {
          log('error', 'Onboarding error', 'onboarding.onError', false, { error });
          setResult(`❌ Onboarding error: ${error?.message || 'unknown error'}`);
          return false;
        },
      });

      setResult('✅ Onboarding view created. Presenting...');
      await view.present();
      setResult('✅ Onboarding presented successfully!');
    } catch (error: any) {
      log('error', 'Failed to present onboarding', 'presentOnboarding', false, {
        error: error?.message || String(error),
      });
      if (error instanceof AdaptyError) {
        setResult(`❌ Failed to present onboarding: ${error.localizedDescription}`);
      } else {
        setResult(`❌ Failed to present onboarding: ${error?.message || String(error)}`);
      }
    }
  };

  useImperativeHandle(ref, () => ({ presentOnboarding }), [
    onboarding,
    externalUrlsPresentation,
    canShowPaywall,
    showPaywall,
  ]);

  return null;
});
