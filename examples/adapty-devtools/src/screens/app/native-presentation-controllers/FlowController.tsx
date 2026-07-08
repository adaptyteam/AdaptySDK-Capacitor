import { forwardRef, useImperativeHandle } from 'react';
import {
  adapty,
  createFlowView,
  AdaptyCustomAsset,
  AdaptyError,
  ErrorCodeName,
  AdaptyFlow,
  FlowViewController,
  FlowEventHandlers,
} from '@adapty/capacitor';
import { APPLE_ICON_IMAGE_BASE64 } from '../../../assets/base64-data.ts';
import { showSuccessToast } from '../../../utils/toast.ts';

export type FlowControllerRef = {
  presentFlow: () => Promise<void>;
};

type Props = {
  flow: AdaptyFlow | null;
  customTagsJson: string;
  setFlowView: (view: FlowViewController | null) => void;
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

      const eventHandlers: Partial<FlowEventHandlers> = {
        onCloseButtonPress: () => {
          log('info', 'User pressed close button', 'flow.onCloseButtonPress');
          setResult('❌ User closed flow');
          return true;
        },
        onAndroidSystemBack: () => {
          log('info', 'User pressed system back button', 'flow.onAndroidSystemBack');
          setResult('⬅️ User pressed back button');
          // Mirror the SDK default: keep the flow view open.
          return false;
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
        onPurchaseStarted: (product) => {
          log('info', 'Purchase started for product', 'flow.onPurchaseStarted', false, { product });
          setResult(`🛒 Purchase started: ${product?.vendorProductId || 'unknown'}`);
          return false;
        },
        onPurchaseCompleted: (purchaseResult, product) => {
          log('info', 'Purchase completed', 'flow.onPurchaseCompleted', false, { purchaseResult, product });
          setResult(`✅ Purchase completed: ${purchaseResult?.type || 'unknown'}`);
          // Mirror the SDK default: keep the flow view open.
          return false;
        },
        onPurchaseFailed: (error, product) => {
          log('error', 'Purchase failed', 'flow.onPurchaseFailed', false, { error, product });
          setResult(`❌ Purchase failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onRestoreStarted: () => {
          log('info', 'Restore started', 'flow.onRestoreStarted');
          setResult('🔄 Restore started...');
          return false;
        },
        onRestoreCompleted: (profile) => {
          log('info', 'Restore completed', 'flow.onRestoreCompleted', false, { profile });
          setResult('✅ Restore completed successfully');
          // Mirror the SDK default: keep the flow view open.
          return false;
        },
        onRestoreFailed: (error) => {
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
        onError: (error) => {
          log('error', 'Flow error', 'flow.onError', false, { error });
          setResult(`💥 Flow error: ${error?.message || 'unknown error'}`);
          // Keep the flow view open on error so the failure stays visible in this dev
          // tool (intentionally differs from the SDK default, which closes the view).
          return false;
        },
        onLoadingProductsFailed: (error) => {
          log('error', 'Loading products failed', 'flow.onLoadingProductsFailed', false, { error });
          setResult(`📦❌ Products loading failed: ${error?.message || 'unknown error'}`);
          return false;
        },
        onWebPaymentNavigationFinished: (product, error) => {
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
        onUrlPress: (url, openIn) => {
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
        onRequestPermission: async (permission, customArgs) => {
          log('info', 'Flow requested permission', 'flow.onRequestPermission', false, { permission, customArgs });
          showSuccessToast(`Flow requested permission: ${permission}`);
          // devtools stub: always reply "granted" so the flow can continue.
          return { status: 'granted' as const };
        },
        onObserverPurchaseInitiated: (product, onStartPurchase, onFinishPurchase) => {
          log('info', 'Observer purchase initiated', 'flow.onObserverPurchaseInitiated', false, { product });
          showSuccessToast('Observer purchase initiated');
          // devtools stub: no real purchase — just drive the paywall loading cycle.
          onStartPurchase();
          onFinishPurchase();
          return false;
        },
        onObserverRestoreInitiated: (onStartRestore: () => void, onFinishRestore: () => void) => {
          log('info', 'Observer restore initiated', 'flow.onObserverRestoreInitiated');
          showSuccessToast('Observer restore initiated');
          // devtools stub: no real restore — just drive the paywall loading cycle.
          onStartRestore();
          onFinishRestore();
          return false;
        },
      };

      await view.setEventHandlers(eventHandlers);

      setResult('✅ Flow view created. Presenting...');
      await view.present();
      setResult('✅ Flow presented successfully!');
    } catch (error) {
      if (error instanceof AdaptyError && error.adaptyCode === ErrorCodeName.notActivated) {
        setResult('SDK not activated. Please activate first');
      } else {
        setResult(`❌ Failed to present flow: ${String(error)}`);
      }

      log('error', 'Failed to present flow', 'presentFlow', false, { error: String(error) });
    }
  };

  useImperativeHandle(ref, () => ({ presentFlow }), [flow, customTagsJson]);

  return null;
});
