import { Adapty } from '../adapty';
import type { AdaptyPaywall } from '../shared/types';
import type { CreatePaywallViewParamsInput } from '../shared/ui/types';
import { ViewController } from '../shared/ui/view-controller';

const adaptyPlugin = new Adapty();

// Export UI types and classes for convenience
export { ViewController };
export type { CreatePaywallViewParamsInput };
export type { AdaptyUiView, AdaptyUiDialogConfig, AdaptyUiDialogActionType, EventHandlers } from '../shared/ui/types';

/**
 * Creates a paywall view controller.
 * You can use it to further configure a view or present it.
 *
 * @see {@link https://docs.adapty.io/docs/paywall-builder-fetching | [DOC] Creating a paywall view}
 *
 * @param {AdaptyPaywall} paywall - paywall that you want to present.
 * @param {CreatePaywallViewParamsInput | undefined} [params] - additional params.
 * @returns {Promise<ViewController>} ViewController — A promise that resolves to a ViewController instance.
 *
 * @example
 * ```ts
 * const paywall = await adapty.getPaywall("MY_PAYWALL");
 * const view = await createPaywallView(paywall);
 * view.present();
 * ```
 *
 * @throws {AdaptyError} — If paywall is not found,
 * does not have a no-code view configured
 * or if there is an error while creating a view.
 */
export async function createPaywallView(
  paywall: AdaptyPaywall,
  params: CreatePaywallViewParamsInput = {},
): Promise<ViewController> {
  const controller = await ViewController.create(paywall, params, adaptyPlugin);

  return controller;
}
