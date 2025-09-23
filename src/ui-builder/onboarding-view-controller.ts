import type { Adapty } from '../adapty';
import { AdaptyError } from '../shared/adapty-error';
import { AdaptyOnboardingCoder } from '../shared/coders/adapty-onboarding';
import { LogContext, Log } from '../shared/logger';
import type { AdaptyOnboarding } from '../shared/types';
import type { components } from '../shared/types/api';

import { OnboardingViewEmitter } from './onboarding-view-emitter';
import { DEFAULT_ONBOARDING_EVENT_HANDLERS } from './types';
import type { AdaptyUiView, OnboardingEventHandlers } from './types';

type Req = components['requests'];

/**
 * Provides methods to control created onboarding view
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
   * Presents an onboarding view as a full-screen modal
   *
   * @remarks
   * Calling `present` upon already visible onboarding view
   * would result in an error
   *
   * @throws {AdaptyError}
   */
  public async present(): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_present_onboarding_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    const data: Req['AdaptyUIPresentOnboardingView.Request'] = {
      method: methodKey,
      id: this.id,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Dismisses an onboarding view
   *
   * @throws {AdaptyError}
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
   * Register event handlers for UI events
   *
   * @remarks
   * Each event type can have only one handler — new handlers replace existing ones.
   * Default handlers are registered in {@link OnboardingViewController.create} and provide standard closing behavior:
   * - `onClose`
   *
   *
   * Calling this method multiple times will replace previously registered handlers for provided events.
   *
   * @param {Partial<OnboardingEventHandlers>} eventHandlers - set of event handling callbacks
   * @returns {() => void} unsubscribe - function to unsubscribe all listeners
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

    // Merge with defaults to ensure default behavior is preserved after unsubscribe/resubscribe cycles
    const finalEventHandlers: Partial<OnboardingEventHandlers> = {
      ...DEFAULT_ONBOARDING_EVENT_HANDLERS,
      ...eventHandlers,
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
   * Clears all registered event handlers
   *
   * @remarks
   * This method removes all previously registered event handlers.
   * After calling this method, no event handlers will be active
   * until you call `setEventHandlers` again.
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
