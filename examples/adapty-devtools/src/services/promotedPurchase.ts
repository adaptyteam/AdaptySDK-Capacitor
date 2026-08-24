import { adapty } from '@adapty/capacitor';
import type { AdaptyPromotedProduct, AdaptyPurchaseResult } from '@adapty/capacitor';
import type { PluginListenerHandle } from '@capacitor/core';

/** One-line summary of a promoted product for the devtools UI. */
export function describePromotedProduct(product: AdaptyPromotedProduct): string {
  const price = product.price?.localizedString;

  return price ? `${product.vendorProductId} — ${price}` : product.vendorProductId;
}

/**
 * Registers an app-owned handler for App Store promoted purchases.
 *
 * The SDK subscribes itself inside `activate()` and, with no app handler
 * registered, completes the purchase on its own. Registering ANY handler
 * switches that default off, so while this subscription is alive the app must
 * call {@link buyPromotedProduct} or the purchase never happens. Removing the
 * returned handle hands control back to the SDK default.
 *
 * Remove it via the returned handle only — `adapty.removeAllListeners()` would
 * also tear down the app-level listeners registered by EventListenersManager.
 */
export function subscribeToPromotedPurchase(
  onProduct: (product: AdaptyPromotedProduct) => void,
): Promise<PluginListenerHandle> {
  return adapty.addListener('onPromotedPurchaseReceived', ({ product }) => onProduct(product));
}

/**
 * Completes a promoted purchase. Unlike `makePurchase`, a promoted product
 * carries no paywall context, so there are no purchase parameters.
 */
export function buyPromotedProduct(product: AdaptyPromotedProduct): Promise<AdaptyPurchaseResult> {
  return adapty.makePromotedPurchase({ product });
}
