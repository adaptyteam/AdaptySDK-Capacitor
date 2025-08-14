import { Adapty } from '../adapty';
import type { AdaptyOnboarding, AdaptyPaywall } from '../shared/types';

import { OnboardingViewController } from './onboarding-view-controller';
import { PaywallViewController } from './paywall-view-controller';
import type { CreatePaywallViewParamsInput } from './types';

const adaptyPlugin = new Adapty();

// Export UI types and classes for convenience
export { PaywallViewController, OnboardingViewController };
export type { CreatePaywallViewParamsInput };
export type { AdaptyUiView, AdaptyUiDialogConfig, AdaptyUiDialogActionType, EventHandlers } from './types';
export type { OnboardingEventHandlers } from './types';

/**
 * Creates a paywall view controller.
 * You can use it to further configure a view or present it.
 *
 * @see {@link https://docs.adapty.io/docs/paywall-builder-fetching | [DOC] Creating a paywall view}
 *
 * @param {AdaptyPaywall} paywall - paywall that you want to present.
 * @param {CreatePaywallViewParamsInput | undefined} [params] - additional params.
 * @returns {Promise<PaywallViewController>} ViewController — A promise that resolves to a ViewController instance.
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
): Promise<PaywallViewController> {
  const controller = await PaywallViewController.create(paywall, params, adaptyPlugin);

  return controller;
}

/**
 * Creates an onboarding view controller.
 * You can use it to further configure a view or present it.
 *
 * @param {AdaptyOnboarding} onboarding - onboarding that you want to present.
 * @returns {Promise<OnboardingViewController>} ViewController — A promise that resolves to a ViewController instance.
 */
export async function createOnboardingView(onboarding: AdaptyOnboarding): Promise<OnboardingViewController> {
  const controller = await OnboardingViewController.create(onboarding, adaptyPlugin);
  return controller;
}
