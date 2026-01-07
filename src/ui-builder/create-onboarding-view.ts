import { Adapty } from '../adapty';
import type { AdaptyOnboarding } from '../shared/types';

import { OnboardingViewController } from './onboarding-view-controller';
import type { CreateOnboardingViewParamsInput } from './types';

const adaptyPlugin = new Adapty();

/**
 * Creates an onboarding view controller.
 * You can use it to further configure a view or present it.
 *
 * @see {@link https://adapty.io/docs/capacitor-get-onboardings | [DOC] Creating an onboarding view}
 *
 * @param {AdaptyOnboarding} onboarding - onboarding that you want to present.
 * @param {CreateOnboardingViewParamsInput | undefined} [params] - additional params.
 * @returns {Promise<OnboardingViewController>} ViewController — A promise that resolves to a ViewController instance.
 *
 * @example
 * ```ts
 * const onboarding = await adapty.getOnboarding({ placementId: 'MY_PLACEMENT' });
 * const view = await createOnboardingView(onboarding);
 * view.present();
 * ```
 *
 * @example
 * ```ts
 * const view = await createOnboardingView(onboarding, {
 *   externalUrlsPresentation: WebPresentation.BrowserOutApp
 * });
 * ```
 *
 * @throws {AdaptyError} — If onboarding is not found,
 * does not have a no-code view configured
 * or if there is an error while creating a view.
 */
export async function createOnboardingView(
  onboarding: AdaptyOnboarding,
  params: CreateOnboardingViewParamsInput = {},
): Promise<OnboardingViewController> {
  const controller = await OnboardingViewController.create(onboarding, adaptyPlugin, params);
  return controller;
}
