import { adapty } from '@adapty/capacitor';
import type { AdaptyPromotedProduct, AdaptyPurchaseResult } from '@adapty/capacitor';
import type { PluginListenerHandle } from '@capacitor/core';

/** One-line summary of a promoted product for the devtools UI. */
export function describePromotedProduct(product: AdaptyPromotedProduct): string {
  const price = product.price?.localizedString;

  return price ? `${product.vendorProductId} — ${price}` : product.vendorProductId;
}

/**
 * One-slot queue that serializes every subscribe and every remove of the
 * app-owned `onPromotedPurchaseReceived` handler.
 *
 * It is module state on purpose. `adapty.addListener` resolves asynchronously,
 * so without an ordering guarantee a fast unsubscribe→subscribe would append a
 * second app-level handler while the first is still registered, and one
 * promoted purchase would be reported twice. A React ref cannot provide that
 * guarantee: the screen lives behind a router and is unmounted and remounted on
 * every tab switch, which would restart a component-scoped chain and let an
 * in-flight subscribe from the previous mount overlap the next one.
 */
let registrationQueue: Promise<void> = Promise.resolve();

/**
 * Appends one step to the queue. The returned promise never rejects — failures
 * go to `onError` — so a single failure can neither poison the chain for later
 * steps nor escape as an unhandled rejection.
 */
function enqueue(step: () => Promise<void>, onError?: (error: unknown) => void): Promise<void> {
  const next = registrationQueue.then(step).catch((error: unknown) => {
    onError?.(error);
  });

  registrationQueue = next;

  return next;
}

/**
 * Registers an app-owned handler for App Store promoted purchases and returns
 * the function that unregisters it.
 *
 * The SDK subscribes itself inside `activate()` and, with no app handler
 * registered, completes the purchase on its own. Registering ANY handler
 * switches that default off, so while this subscription is alive the app must
 * call {@link buyPromotedProduct} or the purchase never happens. Calling the
 * returned function hands control back to the SDK default.
 *
 * Both halves are queued, so at most one app handler for the event exists at
 * any instant, across any interleaving of calls and across remounts. Removal
 * always goes through the handle `addListener` returned — never
 * `adapty.removeAllListeners()`, which would also tear down the app-level
 * listeners registered by EventListenersManager.
 */
export function subscribeToPromotedPurchase(
  onProduct: (product: AdaptyPromotedProduct) => void,
  onError?: (error: unknown) => void,
): () => Promise<void> {
  let handle: PluginListenerHandle | null = null;
  let cancelled = false;

  enqueue(async () => {
    // We may have been unsubscribed while waiting in the queue — then the
    // listener must never be registered in the first place.
    if (cancelled) {
      return;
    }

    const subscription = await adapty.addListener('onPromotedPurchaseReceived', ({ product }) => onProduct(product));

    // addListener resolves asynchronously; if we were unsubscribed meanwhile we
    // must not leave a live subscription behind.
    if (cancelled) {
      await subscription.remove();
      return;
    }

    handle = subscription;
  }, onError);

  return () => {
    // Flip the flag synchronously, before the removal is queued: that is what
    // lets the registration step above short-circuit when it has not run yet
    // (never call addListener at all) or when addListener resolves after we
    // were already unsubscribed (remove the subscription immediately).
    cancelled = true;

    return enqueue(async () => {
      // Queued behind our own registration step, so the next subscribe cannot
      // start until this handler is provably gone. Idempotent: after the first
      // call handle is null and this is a no-op.
      await handle?.remove();
      handle = null;
    }, onError);
  };
}

/**
 * Completes a promoted purchase. Unlike `makePurchase`, a promoted product
 * carries no paywall context, so there are no purchase parameters.
 */
export function buyPromotedProduct(product: AdaptyPromotedProduct): Promise<AdaptyPurchaseResult> {
  return adapty.makePromotedPurchase({ product });
}
