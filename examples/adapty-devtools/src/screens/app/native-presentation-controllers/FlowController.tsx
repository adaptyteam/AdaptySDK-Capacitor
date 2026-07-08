import { forwardRef, useImperativeHandle } from 'react';
import { adapty, createFlowView, AdaptyCustomAsset, AdaptyError, ErrorCodeName } from '@adapty/capacitor';
import { APPLE_ICON_IMAGE_BASE64 } from '../../../assets/base64-data.ts';

export type FlowControllerRef = {
  presentFlow: () => Promise<void>;
};

type Props = {
  flow: any | null;
  customTagsJson: string;
  setFlowView: (view: any | null) => void;
  setResult: (value: string) => void;
  log: (
    level: 'info' | 'error' | 'warn',
    message: string,
    funcName: string,
    isSDK?: boolean,
    params?: Record<string, any>,
  ) => void;
};

export const FlowController = forwardRef<FlowControllerRef, Props>(function FlowController(
  { flow, customTagsJson, setFlowView, setResult, log }: Props,
  ref,
) {
  const presentFlow = async () => {
    if (!flow) {
      setResult('❌ No flow loaded. Please load flow first.');
      return;
    }

    try {
      setResult('Creating flow view...');

      let customTags: Record<string, string>;
      try {
        customTags = JSON.parse(customTagsJson);
      } catch (error) {
        customTags = {};
        log('warn', 'Invalid custom tags JSON, using empty object', 'presentFlow', false, {
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

      const view = await createFlowView(flow, { customTags, customAssets });
      setFlowView(view);

      await view.setEventHandlers({
        onCloseButtonPress: () => {
          log('info', 'User pressed close button', 'flow.onCloseButtonPress');
          setResult('❌ User closed flow');
          return true;
        },
        onAndroidSystemBack: () => {
          log('info', 'User pressed system back button', 'flow.onAndroidSystemBack');
          setResult('⬅️ User pressed back button');
          return true;
        },
        onCustomAction: (actionId: string) => {
          log('info', 'User performed custom action', 'flow.onCustomAction', false, { actionId });
          setResult(`⚡ Custom action: ${actionId}`);
          return false;
        },
        onProductSelected: (productId: string) => {
          log('info', 'User selected product', 'flow.onProductSelected', false, { productId });
          setResult(`📦 Product selected: ${productId}`);
          return false;
        },
        onPurchaseStarted: (product: any) => {
          log('info', 'Purchase started for product', 'flow.onPurchaseStarted', false, { product });
          setResult(`🛒 Purchase started: ${product?.vendorProductId || 'unknown'}`);
          return false;
        },
        onPurchaseCompleted: (purchaseResult: any, product: any) => {
          log('info', 'Purchase completed', 'flow.onPurchaseCompleted', false, { purchaseResult, product });
          setResult(`✅ Purchase completed: ${purchaseResult?.type || 'unknown'}`);
          return purchaseResult?.type !== 'user_cancelled';
        },
        onPurchaseFailed: (error: any, product: any) => {
          log('error', 'Purchase failed', 'flow.onPurchaseFailed', false, { error, product });
          setResult(`❌ Purchase failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onRestoreStarted: () => {
          log('info', 'Restore started', 'flow.onRestoreStarted');
          setResult('🔄 Restore started...');
          return false;
        },
        onRestoreCompleted: (profile: any) => {
          log('info', 'Restore completed', 'flow.onRestoreCompleted', false, { profile });
          setResult('✅ Restore completed successfully');
          return true;
        },
        onRestoreFailed: (error: any) => {
          log('error', 'Restore failed', 'flow.onRestoreFailed', false, { error });
          setResult(`❌ Restore failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onAppeared: () => {
          log('info', 'Flow appeared', 'flow.onAppeared');
          setResult('👁️ Flow appeared');
          return false;
        },
        onDisappeared: () => {
          log('info', 'Flow disappeared', 'flow.onDisappeared');
          setResult('👋 Flow disappeared');
          return false;
        },
        onError: (error: any) => {
          log('error', 'Flow error', 'flow.onError', false, { error });
          setResult(`💥 Flow error: ${error?.message || 'unknown error'}`);
          return false;
        },
        onLoadingProductsFailed: (error: any) => {
          log('error', 'Loading products failed', 'flow.onLoadingProductsFailed', false, { error });
          setResult(`📦❌ Products loading failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onWebPaymentNavigationFinished: (product: any, error: any) => {
          log('info', 'Web payment navigation finished', 'flow.onWebPaymentNavigationFinished', false, {
            product,
            error,
          });
          setResult(`🌐 Web payment finished: ${error ? 'with error' : 'success'}`);
          return false;
        },
        // Delegate to the handler method, which opens the URL natively honoring
        // `openIn` (`browser_out_app` -> external browser, `browser_in_app` ->
        // in-app browser), same as the SDK's default onUrlPress handler.
        onUrlPress: (url: string, openIn: any) => {
          log('info', 'User pressed URL', 'flow.onUrlPress', false, { url, openIn });
          adapty
            .openWebUrl({ url, openIn })
            .catch((error) =>
              log('warn', 'Failed to open URL via native', 'flow.onUrlPress', false, { error: String(error) }),
            );
          return false;
        },
        // --- New Flow API 4.0 handlers (observer/permission: log only) ---
        onAnalytics: (name: string, params: Record<string, unknown>) => {
          log('info', 'Flow analytics event', 'flow.onAnalytics', false, { name, params });
          return false;
        },
        // Delegate to the handler method, which shows the platform app-review
        // prompt natively, same as the SDK's default onRequestAppReview handler.
        onRequestAppReview: () => {
          log('info', 'Flow requested app review', 'flow.onRequestAppReview');
          adapty
            .requestAppReview()
            .then(() => log('info', 'Requested app review', 'flow.onRequestAppReview'))
            .catch((error) =>
              log('warn', 'Failed to request app review', 'flow.onRequestAppReview', false, { error: String(error) }),
            );
          return false;
        },
        onRequestPermission: async (permission: any, customArgs: Record<string, string>) => {
          log('info', 'Flow requested permission', 'flow.onRequestPermission', false, { permission, customArgs });
          // devtools stub: always reply "granted" so the flow can continue.
          return { status: 'granted' as const };
        },
        onObserverPurchaseInitiated: (product: any, onStartPurchase: () => void, onFinishPurchase: () => void) => {
          log('info', 'Observer purchase initiated', 'flow.onObserverPurchaseInitiated', false, { product });
          // devtools stub: no real purchase — just drive the paywall loading cycle.
          onStartPurchase();
          onFinishPurchase();
          return false;
        },
        onObserverRestoreInitiated: (onStartRestore: () => void, onFinishRestore: () => void) => {
          log('info', 'Observer restore initiated', 'flow.onObserverRestoreInitiated');
          // devtools stub: no real restore — just drive the paywall loading cycle.
          onStartRestore();
          onFinishRestore();
          return false;
        },
      });

      setResult('✅ Flow view created. Presenting...');
      await view.present();
      setResult('✅ Flow presented successfully!');
    } catch (error: any) {
      if (error instanceof AdaptyError && error.adaptyCode === ErrorCodeName.notActivated) {
        setResult('SDK not activated. Please activate first');
      } else {
        setResult(`❌ Failed to present flow: ${error?.message || String(error)}`);
      }

      log('error', 'Failed to present flow', 'presentFlow', false, { error: error?.message || String(error) });
    }
  };

  useImperativeHandle(ref, () => ({ presentFlow }), [flow, customTagsJson]);

  return null;
});
