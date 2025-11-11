import type { Adapty } from '../adapty';
import { AdaptyError } from '../shared/adapty-error';
import { AdaptyOnboardingCoder } from '../shared/coders/adapty-onboarding';
import { LogContext, Log } from '../shared/logger';
import type { AdaptyOnboarding } from '../shared/types';
import type { components } from '../shared/types/api';
import { mapValues } from '../shared/utils/map-values';
import { withErrorContext } from '../shared/utils/with-error-context';

import { OnboardingViewEmitter } from './onboarding-view-emitter';
import { DEFAULT_ONBOARDING_EVENT_HANDLERS } from './types';
import type { AdaptyUiView, OnboardingEventHandlers, AdaptyIOSPresentationStyle } from './types';

type Req = components['requests'];

/**
 * Controller for managing onboarding views.
 *
 * @remarks
 * This class provides methods to present, dismiss, and handle events for onboarding views
 * created with the Onboarding Builder. Create instances using the {@link createOnboardingView} function
 * rather than directly constructing this class.
 *
 * @public
 */
export class OnboardingViewController {
  private id: string | null = null;
  private adaptyPlugin: Adapty;
  private viewEmitter: OnboardingViewEmitter | null = null;

  /**
   * Intended way to create a OnboardingViewController instance.
   * It prepares a native controller to be presented
   * and creates reference between native controller and JS instance
   * @internal
   */
  static async create(onboarding: AdaptyOnboarding, adaptyPlugin: Adapty): Promise<OnboardingViewController> {
    const controller = new OnboardingViewController(adaptyPlugin);

    const ctx = new LogContext();
    const methodKey = 'adapty_ui_create_onboarding_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ onboarding }));

    const coder = new AdaptyOnboardingCoder();
    const data: Req['AdaptyUICreateOnboardingView.Request'] = {
      method: methodKey,
      onboarding: coder.encode(onboarding),
    };

    const result = (await controller.adaptyPlugin.handleMethodCall(
      methodKey,
      JSON.stringify(data),
      ctx,
      log,
    )) as AdaptyUiView;
    controller.id = result.id;

    await controller.setEventHandlers(DEFAULT_ONBOARDING_EVENT_HANDLERS);

    return controller;
  }

  /**
   * Since constructors in JS cannot be async, it is not
   * preferred to create ViewControllers in direct way.
   * Consider using @link{OnboardingViewController.create} instead
   *
   * @internal
   */
  private constructor(adaptyPlugin: Adapty) {
    this.adaptyPlugin = adaptyPlugin;
  }

  /**
   * Presents the onboarding view as a modal screen.
   *
   * @remarks
   * Calling `present` on an already visible onboarding view will result in an error.
   * The onboarding will be displayed with the configured presentation style on iOS.
   * On Android, the onboarding is always presented as a full-screen activity.
   *
   * @param options - Optional presentation options
   * @param options.iosPresentationStyle - iOS presentation style. Available options: `'full_screen'` (default) or `'page_sheet'`. Only affects iOS platform.
   * @returns A promise that resolves when the onboarding is presented.
   * @throws {@link AdaptyError} if the view reference is invalid or the view is already presented.
   *
   * @example
   * Present with default full-screen style
   * ```typescript
   * import { adapty, createOnboardingView } from '@adapty/capacitor';
   *
   * const onboarding = await adapty.getOnboarding({ placementId: 'YOUR_PLACEMENT_ID' });
   * const view = await createOnboardingView(onboarding);
   * await view.present();
   * ```
   *
   * @example
   * Present with page sheet style on iOS
   * ```typescript
   * await view.present({ iosPresentationStyle: 'page_sheet' });
   * ```
   */
  public async present(options: { iosPresentationStyle?: AdaptyIOSPresentationStyle } = {}): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_present_onboarding_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id, iosPresentationStyle: options.iosPresentationStyle }));

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    const data: any = {
      method: methodKey,
      id: this.id,
      ios_presentation_style: options.iosPresentationStyle ?? 'full_screen',
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Dismisses the onboarding view.
   *
   * @remarks
   * This method closes the onboarding and cleans up associated resources.
   * After dismissing, the view controller instance cannot be reused.
   *
   * @returns A promise that resolves when the onboarding is dismissed.
   * @throws {@link AdaptyError} if the view reference is invalid.
   *
   * @example
   * ```typescript
   * import { createOnboardingView } from '@adapty/capacitor';
   *
   * const view = await createOnboardingView(onboarding);
   * await view.present();
   * // ... later
   * await view.dismiss();
   * ```
   */
  public async dismiss(): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_dismiss_onboarding_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    const data: Req['AdaptyUIDismissOnboardingView.Request'] = {
      method: methodKey,
      id: this.id,
      destroy: true,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  private onRequestClose = async () => {
    try {
      await this.dismiss();
    } catch (error) {
      Log.warn(
        'setEventHandlers',
        () => 'Failed to dismiss onboarding',
        () => ({ error }),
      );
    }
  };

  /**
   * Registers event handlers for onboarding UI events.
   *
   * @remarks
   * Each event type can have only one handler — new handlers replace existing ones.
   * Default handlers are registered automatically in {@link createOnboardingView} and provide standard closing behavior:
   * - `onClose` - closes the onboarding when the close button is pressed or system back is used
   *
   * If you want to override the `onClose` listener, we strongly recommend returning `true`
   * from your custom listener to retain default closing behavior.
   *
   * Calling this method multiple times will replace previously registered handlers for provided events.
   *
   * @see {@link https://adapty.io/docs/capacitor-handling-onboarding-events | Handling Onboarding Events}
   *
   * @param eventHandlers - Set of event handling callbacks. Only provided handlers will be registered or updated.
   * @returns A promise that resolves to an unsubscribe function that removes all registered listeners.
   *
   * @example
   * Register custom event handlers
   * ```typescript
   * import { createOnboardingView } from '@adapty/capacitor';
   *
   * const view = await createOnboardingView(onboarding);
   *
   * const unsubscribe = await view.setEventHandlers({
   *   onClose: () => {
   *     console.log('Onboarding closed');
   *     // Return true to keep default closing behavior
   *     return true;
   *   },
   *   onActionPerformed: (action) => {
   *     console.log('Action performed:', action.name);
   *   },
   *   onProductSelected: (product) => {
   *     console.log('Product selected:', product.vendorProductId);
   *   }
   * });
   *
   * await view.present();
   *
   * // Later, unsubscribe all handlers
   * unsubscribe();
   * ```
   */
  public async setEventHandlers(eventHandlers: Partial<OnboardingEventHandlers> = {}): Promise<() => void> {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'setEventHandlers' });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    Log.verbose(
      'setEventHandlers',
      () => 'Registering onboarding event handlers for view',
      () => ({ id: this.id }),
    );

    const viewEmitter = this.viewEmitter ?? new OnboardingViewEmitter(this.id);
    this.viewEmitter = viewEmitter;

    const wrappedErrorLogEventHandlers = mapValues(eventHandlers, (handler, eventName) =>
      handler && typeof handler === 'function'
        ? withErrorContext(handler, eventName as string, 'OnboardingViewController')
        : undefined,
    );

    // Merge with defaults to ensure default behavior is preserved after unsubscribe/resubscribe cycles
    const finalEventHandlers: Partial<OnboardingEventHandlers> = {
      ...DEFAULT_ONBOARDING_EVENT_HANDLERS,
      ...wrappedErrorLogEventHandlers,
    };

    for (const [eventName, handler] of Object.entries(finalEventHandlers)) {
      if (handler && typeof handler === 'function') {
        try {
          await viewEmitter.addListener(eventName as keyof OnboardingEventHandlers, handler, this.onRequestClose);
          Log.verbose(
            'setEventHandlers',
            () => 'Registered onboarding handler',
            () => ({ eventName }),
          );
        } catch (error) {
          Log.error(
            'setEventHandlers',
            () => `Failed to register onboarding handler for ${eventName}`,
            () => ({ error }),
          );
        }
      }
    }

    const unsubscribe = () => {
      Log.info(
        'setEventHandlers',
        () => 'Unsubscribing onboarding event handlers for view',
        () => ({ id: this.id }),
      );
      if (this.viewEmitter) {
        this.viewEmitter.removeAllListeners();
        this.viewEmitter = null;
      }
    };

    return unsubscribe;
  }

  /**
   * Clears all registered event handlers.
   *
   * @remarks
   * This method removes all previously registered event handlers.
   * After calling this method, no event handlers will be active
   * until you call {@link setEventHandlers} again.
   *
   * Use this after dismiss to remove all event handlers.
   *
   * @example
   * ```typescript
   * const view = await createOnboardingView(onboarding);
   * await view.setEventHandlers({ onClose: handleClose });
   *
   * // Later, clear all handlers
   * view.clearEventHandlers();
   * ```
   */
  public clearEventHandlers(): void {
    Log.info(
      'clearEventHandlers',
      () => 'Clearing all onboarding event handlers for view',
      () => ({ id: this.id }),
    );

    if (this.viewEmitter) {
      this.viewEmitter.removeAllListeners();
      this.viewEmitter = null;
    }
  }
}
