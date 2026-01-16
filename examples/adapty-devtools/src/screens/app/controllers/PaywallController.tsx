import { forwardRef, useImperativeHandle } from 'react';
import { createPaywallView, AdaptyCustomAsset, AdaptyError, ErrorCodeName } from '@adapty/capacitor';
import { APPLE_ICON_IMAGE_BASE64 } from '../base64-data';

export type PaywallControllerRef = {
  presentPaywall: () => Promise<void>;
};

type Props = {
  paywall: any | null;
  customTagsJson: string;
  setPaywallView: (view: any | null) => void;
  setResult: (value: string) => void;
  log: (
    level: 'info' | 'error' | 'warn',
    message: string,
    funcName: string,
    isSDK?: boolean,
    params?: Record<string, any>,
  ) => void;
};

export const PaywallController = forwardRef<PaywallControllerRef, Props>(function PaywallController(
  { paywall, customTagsJson, setPaywallView, setResult, log }: Props,
  ref,
) {
  const presentPaywall = async () => {
    if (!paywall) {
      setResult('❌ No paywall loaded. Please load paywall first.');
      return;
    }

    if (!paywall.hasViewConfiguration) {
      setResult('❌ Paywall does not have view configuration (no Paywall Builder).');
      return;
    }

    try {
      setResult('Creating paywall view...');

      let customTags: Record<string, string>;
      try {
        customTags = JSON.parse(customTagsJson);
      } catch (error) {
        customTags = {};
        log('warn', 'Invalid custom tags JSON, using empty object', 'presentPaywall', false, {
          error: String(error),
          customTagsText: customTags,
        });
      }

      const customAssets = {
        custom_image_walter_white: { type: 'image' as const, relativeAssetPath: 'Walter_White.png' },
        hero_image: { type: 'image' as const, relativeAssetPath: 'landscape.png' },
        custom_image_landscape: { type: 'image' as const, relativeAssetPath: 'landscape.png' },
        custom_video_mp4: { type: 'video' as const, relativeAssetPath: 'demo_video.mp4' },
        hero_video: { type: 'video' as const, relativeAssetPath: 'demo_video.mp4' },
        apple_icon_image: { type: 'image' as const, base64: APPLE_ICON_IMAGE_BASE64 },
      } satisfies Record<string, AdaptyCustomAsset>;

      const view = await createPaywallView(paywall, { customTags, customAssets });
      setPaywallView(view);

      await view.setEventHandlers({
        onCloseButtonPress: () => {
          log('info', 'User pressed close button', 'paywall.onCloseButtonPress');
          setResult('❌ User closed paywall');
          return true;
        },
        onAndroidSystemBack: () => {
          log('info', 'User pressed system back button', 'paywall.onAndroidSystemBack');
          setResult('⬅️ User pressed back button');
          return true;
        },
        onCustomAction: (action: any) => {
          log('info', 'User performed custom action', 'paywall.onCustomAction', false, { action });
          setResult(`⚡ Custom action: ${JSON.stringify(action)}`);
          return false;
        },
        onProductSelected: (productId: string) => {
          log('info', 'User selected product', 'paywall.onProductSelected', false, { productId });
          setResult(`📦 Product selected: ${productId}`);
          return false;
        },
        onPurchaseStarted: (product: any) => {
          log('info', 'Purchase started for product', 'paywall.onPurchaseStarted', false, { product });
          setResult(`🛒 Purchase started: ${product?.vendorProductId || 'unknown'}`);
          return false;
        },
        onPurchaseCompleted: (purchaseResult: any, product: any) => {
          log('info', 'Purchase completed', 'paywall.onPurchaseCompleted', false, { purchaseResult, product });
          setResult(`✅ Purchase completed: ${purchaseResult?.type || 'unknown'}`);
          return purchaseResult?.type !== 'user_cancelled';
        },
        onPurchaseFailed: (error: any, product: any) => {
          log('error', 'Purchase failed', 'paywall.onPurchaseFailed', false, { error, product });
          setResult(`❌ Purchase failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onRestoreStarted: () => {
          log('info', 'Restore started', 'paywall.onRestoreStarted');
          setResult('🔄 Restore started...');
          return false;
        },
        onRestoreCompleted: (profile: any) => {
          log('info', 'Restore completed', 'paywall.onRestoreCompleted', false, { profile });
          setResult('✅ Restore completed successfully');
          return true;
        },
        onRestoreFailed: (error: any) => {
          log('error', 'Restore failed', 'paywall.onRestoreFailed', false, { error });
          setResult(`❌ Restore failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onPaywallShown: () => {
          log('info', 'Paywall shown', 'paywall.onPaywallShown');
          setResult('👁️ Paywall appeared');
          return false;
        },
        onPaywallClosed: () => {
          log('info', 'Paywall closed', 'paywall.onPaywallClosed');
          setResult('👋 Paywall disappeared');
          return false;
        },
        onRenderingFailed: (error: any) => {
          log('error', 'Rendering failed', 'paywall.onRenderingFailed', false, { error });
          setResult(`💥 Rendering failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onLoadingProductsFailed: (error: any) => {
          log('error', 'Loading products failed', 'paywall.onLoadingProductsFailed', false, { error });
          setResult(`📦❌ Products loading failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onWebPaymentNavigationFinished: (product: any, error: any) => {
          log('info', 'Web payment navigation finished', 'paywall.onWebPaymentNavigationFinished', false, {
            product,
            error,
          });
          setResult(`🌐 Web payment finished: ${error ? 'with error' : 'success'}`);
          return false;
        },
      });

      setResult('✅ Paywall view created. Presenting...');
      await view.present();
      setResult('✅ Paywall presented successfully!');
    } catch (error: any) {
      if (error instanceof AdaptyError && error.adaptyCode === ErrorCodeName.notActivated) {
        setResult('SDK not activated. Please activate first');
      } else {
        setResult(`❌ Failed to present paywall: ${error?.message || String(error)}`);
      }

      log('error', 'Failed to present paywall', 'presentPaywall', false, { error: error?.message || String(error) });
    }
  };

  useImperativeHandle(ref, () => ({ presentPaywall }), [paywall, customTagsJson]);

  return null;
});

