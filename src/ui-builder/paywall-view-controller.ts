import type { Adapty } from '../adapty';
import { AdaptyError } from '../shared/adapty-error';
import { AdaptyPaywallCoder } from '../shared/coders/adapty-paywall';
import { LogContext, Log } from '../shared/logger';
import type { AdaptyPaywall } from '../shared/types';
import type { components } from '../shared/types/api';

import { PaywallViewEmitter } from './paywall-view-emitter';
import type {
  AdaptyUiView,
  CreatePaywallViewParamsInput,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  EventHandlers,
} from './types';
import { DEFAULT_EVENT_HANDLERS } from './types';

type Req = components['requests'];

/**
 * Provides methods to control created paywall view
 * @public
 */
export class PaywallViewController {
  private id: string | null = null;
  private adaptyPlugin: Adapty;
  private viewEmitter: PaywallViewEmitter | null = null;

  /**
   * Intended way to create a ViewController instance.
   * It prepares a native controller to be presented
   * and creates reference between native controller and JS instance
   * @internal
   */
  static async create(
    paywall: AdaptyPaywall,
    params: CreatePaywallViewParamsInput,
    adaptyPlugin: Adapty,
  ): Promise<PaywallViewController> {
    const controller = new PaywallViewController(adaptyPlugin);

    const ctx = new LogContext();
    const methodKey = 'adapty_ui_create_paywall_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ paywall, params }));

    const coder = new AdaptyPaywallCoder();
    const data: Req['AdaptyUICreatePaywallView.Request'] = {
      method: methodKey,
      paywall: coder.encode(paywall),
      preload_products: params.prefetchProducts ?? true,
      load_timeout: (params.loadTimeoutMs ?? 5000) / 1000,
    };

    if (params.customTags) {
      data.custom_tags = params.customTags;
    }

    if (params.customTimers) {
      const convertTimerInfo = (timerInfo: Record<string, Date>): Record<string, string> => {
        const formatDate = (date: Date): string => {
          const pad = (num: number, digits = 2): string => {
            const str = num.toString();
            const paddingLength = digits - str.length;
            return paddingLength > 0 ? '0'.repeat(paddingLength) + str : str;
          };

          const year = date.getUTCFullYear();
          const month = pad(date.getUTCMonth() + 1);
          const day = pad(date.getUTCDate());
          const hours = pad(date.getUTCHours());
          const minutes = pad(date.getUTCMinutes());
          const seconds = pad(date.getUTCSeconds());
          const millis = pad(date.getUTCMilliseconds(), 3);

          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}Z`;
        };

        const result: Record<string, string> = {};
        for (const key in timerInfo) {
          if (Object.prototype.hasOwnProperty.call(timerInfo, key)) {
            const date = timerInfo[key];
            if (date instanceof Date) {
              result[key] = formatDate(date);
            }
          }
        }
        return result;
      };
      data.custom_timers = convertTimerInfo(params.customTimers);
    }

    const result = (await controller.adaptyPlugin.handleMethodCall(
      methodKey,
      JSON.stringify(data),
      ctx,
      log,
    )) as AdaptyUiView;
    controller.id = result.id;

    await controller.setEventHandlers(DEFAULT_EVENT_HANDLERS);

    return controller;
  }

  /**
   * Since constructors in JS cannot be async, it is not
   * preferred to create ViewControllers in direct way.
   * Consider using @link{ViewController.create} instead
   *
   * @internal
   */
  private constructor(adaptyPlugin: Adapty) {
    this.adaptyPlugin = adaptyPlugin;
  }

  /**
   * Presents a paywall view as a full-screen modal
   *
   * @remarks
   * Calling `present` upon already visible paywall view
   * would result in an error
   *
   * @throws {AdaptyError}
   */
  public async present(): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_present_paywall_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIPresentPaywallView.Request'] = {
      method: methodKey,
      id: this.id,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Dismisses a paywall view
   *
   * @throws {AdaptyError}
   */
  public async dismiss(): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_dismiss_paywall_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIDismissPaywallView.Request'] = {
      method: methodKey,
      id: this.id,
      destroy: false,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Presents the dialog
   *
   * @param {AdaptyUiDialogConfig} config - A config for showing the dialog.
   *
   * @remarks
   * If you provide two actions in the config, be sure `primaryAction` cancels the operation
   * and leaves things unchanged.
   *
   * @returns {Promise<AdaptyUiDialogActionType>} A Promise that resolves to the {@link AdaptyUiDialogActionType} object
   *
   * @throws {AdaptyError}
   */
  public async showDialog(config: AdaptyUiDialogConfig): Promise<AdaptyUiDialogActionType> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_show_dialog';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const dialogConfig = {
      default_action_title: config.primaryActionTitle,
      secondary_action_title: config.secondaryActionTitle,
      title: config.title,
      content: config.content,
    };

    const data: Req['AdaptyUIShowDialog.Request'] = {
      method: methodKey,
      id: this.id,
      configuration: dialogConfig,
    };

    return await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  private onRequestClose = async () => {
    try {
      await this.dismiss();
    } catch (error) {
      Log.warn(
        'setEventHandlers',
        () => 'Failed to dismiss paywall',
        () => ({ error }),
      );
    }
  };

  /**
   * Register event handlers for UI events
   *
   * @see {@link https://docs.adapty.io/docs/react-native-handling-events-1 | [DOC] Handling View Events}
   *
   * @remarks
   * Each event type can have only one handler — new handlers replace existing ones.
   * Default handlers are registered in {@link PaywallViewController.create} and provide standard closing behavior:
   * - `onCloseButtonPress`
   * - `onAndroidSystemBack`
   * - `onRestoreCompleted`
   * - `onPurchaseCompleted`
   *
   *
   * If you want to override these listeners, we strongly recommend to return `true` (or `purchaseResult.type !== 'user_cancelled'` in case of `onPurchaseCompleted`)
   * from your custom listener to retain default closing behavior.
   *
   * Calling this method multiple times will replace previously registered handlers for provided events.
   *
   * @param {Partial<EventHandlers>} eventHandlers - set of event handling callbacks
   * @returns {() => void} unsubscribe - function to unsubscribe all listeners
   */
  public async setEventHandlers(eventHandlers: Partial<EventHandlers> = {}): Promise<() => void> {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'setEventHandlers' });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    Log.verbose(
      'setEventHandlers',
      () => 'Registering event handlers for view',
      () => ({ id: this.id }),
    );

    const viewEmitter = this.viewEmitter ?? new PaywallViewEmitter(this.id);
    this.viewEmitter = viewEmitter;

    // Merge with defaults to ensure default behavior is preserved after unsubscribe/resubscribe cycles
    const finalEventHandlers: EventHandlers = {
      ...DEFAULT_EVENT_HANDLERS,
      ...eventHandlers,
    };

    for (const [eventName, handler] of Object.entries(finalEventHandlers)) {
      if (handler && typeof handler === 'function') {
        try {
          await viewEmitter.addListener(eventName as keyof EventHandlers, handler, this.onRequestClose);
          Log.verbose(
            'setEventHandlers',
            () => 'Registered handler for',
            () => ({ eventName }),
          );
        } catch (error) {
          Log.error(
            'setEventHandlers',
            () => `Failed to register handler for ${eventName}`,
            () => ({ error }),
          );
        }
      }
    }

    // Return unsubscribe function
    const unsubscribe = () => {
      Log.info(
        'setEventHandlers',
        () => 'Unsubscribing event handlers for view',
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
