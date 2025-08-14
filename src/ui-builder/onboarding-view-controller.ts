import type { Adapty } from '../adapty';
import { AdaptyError } from '../shared/adapty-error';
import { AdaptyOnboardingCoder } from '../shared/coders/adapty-onboarding';
import { LogContext, Log } from '../shared/logger';
import type { AdaptyOnboarding } from '../shared/types';
import type { components } from '../shared/types/api';

import { OnboardingViewEmitter } from './onboarding-view-emitter';
import { DEFAULT_ONBOARDING_EVENT_HANDLERS } from './types';
import type { AdaptyUiView, type OnboardingEventHandlers } from './types';

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
    log.start({ onboarding });

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
    log.start({ _id: this.id });

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
    log.start({ _id: this.id });

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    const data: Req['AdaptyUIDismissOnboardingView.Request'] = {
      method: methodKey,
      id: this.id,
      destroy: false,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);

    if (this.viewEmitter) {
      this.viewEmitter.removeAllListeners();
      this.viewEmitter = null;
    }
  }

  /**
   * Register event handlers for UI events
   *
   * @remarks
   * It registers only requested set of event handlers.
   * Your config is assigned into event listener defaults,
   * that handle default closing behavior.
   * - `onClose`
   *
   * @param {Partial<OnboardingEventHandlers> | undefined} [eventHandlers] - set of event handling callbacks
   * @returns {() => void} unsubscribe - function to unsubscribe all listeners
   */
  public registerEventHandlers(
    eventHandlers: Partial<OnboardingEventHandlers> = DEFAULT_ONBOARDING_EVENT_HANDLERS,
  ): () => void {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'registerEventHandlers' });
    log.start({ _id: this.id });

    if (this.id === null) {
      throw new AdaptyError({ adaptyCode: 2002, message: 'No view reference' });
    }

    Log.verbose(
      'registerEventHandlers',
      () => 'Registering onboarding event handlers for view',
      () => ({ id: this.id }),
    );

    const viewEmitter = this.viewEmitter ?? new OnboardingViewEmitter(this.id);
    this.viewEmitter = viewEmitter;

    const finalEventHandlers: OnboardingEventHandlers = {
      ...DEFAULT_ONBOARDING_EVENT_HANDLERS,
      ...eventHandlers,
    } as OnboardingEventHandlers;

    const onRequestClose = async () => {
      try {
        await this.dismiss();
      } catch (error) {
        Log.warn(
          'registerEventHandlers',
          () => 'Failed to dismiss onboarding',
          () => ({ error }),
        );
      }
    };

    Object.entries(finalEventHandlers).forEach(([eventName, handler]) => {
      if (handler && typeof handler === 'function') {
        try {
          viewEmitter.addListener(eventName as keyof OnboardingEventHandlers, handler as any, onRequestClose);
          Log.verbose(
            'registerEventHandlers',
            () => 'Registered handler for',
            () => ({ eventName }),
          );
        } catch (error) {
          Log.error(
            'registerEventHandlers',
            () => `Failed to register handler for ${eventName}`,
            () => ({ error }),
          );
        }
      }
    });

    const unsubscribe = () => {
      Log.info(
        'registerEventHandlers',
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
}
