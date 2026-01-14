import type { Adapty } from '../adapty';
import { AdaptyError } from '../shared/adapty-error';
import { AdaptyPaywallCoder } from '../shared/coders/adapty-paywall';
import { LogContext, Log } from '../shared/logger';
import type { AdaptyPaywall } from '../shared/types';
import type { components } from '../shared/types/api';
import { mapValues } from '../shared/utils/map-values';
import { withErrorContext } from '../shared/utils/with-error-context';

import { PaywallViewEmitter } from './paywall-view-emitter';
import type {
  AdaptyUiView,
  CreatePaywallViewParamsInput,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  EventHandlers,
  AdaptyIOSPresentationStyle,
} from './types';
import { DEFAULT_EVENT_HANDLERS } from './types';

type Req = components['requests'];

/**
 * Controller for managing paywall views.
 *
 * @remarks
 * This class provides methods to present, dismiss, and handle events for paywall views
 * created with the Paywall Builder. Create instances using the {@link createPaywallView} function
 * rather than directly constructing this class.
 *
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
    controller.viewEmitter = new PaywallViewEmitter(controller.id);

    await controller.setEventHandlers(DEFAULT_EVENT_HANDLERS);

    await controller.viewEmitter.addInternalListener('onPaywallClosed', () => {
      if (controller.viewEmitter) {
        controller.viewEmitter.removeAllListeners();
        controller.viewEmitter = null;
      }
    });

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
   * Presents the paywall view as a modal screen.
   *
   * @remarks
   * Calling `present` on an already visible paywall view will result in an error.
   * The paywall will be displayed with the configured presentation style on iOS.
   * On Android, the paywall is always presented as a full-screen activity.
   *
   * @param options - Optional presentation options
   * @param options.iosPresentationStyle - iOS presentation style. Available options: `'full_screen'` (default) or `'page_sheet'`. Only affects iOS platform.
   * @returns A promise that resolves when the paywall is presented.
   * @throws {@link AdaptyError} if the view reference is invalid or the view is already presented.
   *
   * @example
   * Present with default full-screen style
   * ```typescript
   * import { adapty, createPaywallView } from '@adapty/capacitor';
   *
   * const paywall = await adapty.getPaywall({ placementId: 'YOUR_PLACEMENT_ID' });
   * const view = await createPaywallView(paywall);
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
    const methodKey = 'adapty_ui_present_paywall_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id, iosPresentationStyle: options.iosPresentationStyle }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: any = {
      method: methodKey,
      id: this.id,
      ios_presentation_style: options.iosPresentationStyle ?? 'full_screen',
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Dismisses the paywall view.
   *
   * @remarks
   * This method closes the paywall and cleans up associated resources.
   * After dismissing, the view controller instance cannot be reused.
   *
   * @returns A promise that resolves when the paywall is dismissed.
   * @throws {@link AdaptyError} if the view reference is invalid.
   *
   * @example
   * ```typescript
   * import { createPaywallView } from '@adapty/capacitor';
   *
   * const view = await createPaywallView(paywall);
   * await view.present();
   * // ... later
   * await view.dismiss();
   * ```
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
      destroy: true,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Displays a dialog to the user.
   *
   * @remarks
   * Use this method to show custom dialogs within the paywall flow.
   * If you provide two actions in the config, the primary action should cancel the operation
   * and leave things unchanged, while the secondary action should confirm the operation.
   *
   * @param config - Configuration for the dialog.
   * @param config.title - The dialog title.
   * @param config.content - The dialog message content.
   * @param config.primaryActionTitle - The title for the primary (default) action button.
   * @param config.secondaryActionTitle - Optional. The title for the secondary action button.
   * @returns A promise that resolves to the action type that the user selected: `'primary'` or `'secondary'`.
   * @throws {@link AdaptyError} if the view reference is invalid.
   *
   * @example
   * Show confirmation dialog
   * ```typescript
   * const action = await view.showDialog({
   *   title: 'Confirm Purchase',
   *   content: 'Are you sure you want to proceed with this purchase?',
   *   primaryActionTitle: 'Cancel',
   *   secondaryActionTitle: 'Continue'
   * });
   *
   * if (action === 'secondary') {
   *   console.log('User confirmed');
   * }
   * ```
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
   * Registers event handlers for paywall UI events.
   *
   * @remarks
   * Each event type can have only one handler — new handlers replace existing ones.
   * Default handlers are registered automatically in {@link createPaywallView} and provide standard closing behavior:
   * - `onCloseButtonPress` - closes the paywall
   * - `onAndroidSystemBack` - closes the paywall (Android only)
   * - `onRestoreCompleted` - closes the paywall after successful restore
   * - `onRenderingFailed` - closes the paywall when rendering fails
   * - `onPurchaseCompleted` - closes the paywall after successful purchase
   *
   * If you want to override these listeners, we strongly recommend returning `true`
   * (or `purchaseResult.type !== 'user_cancelled'` in case of `onPurchaseCompleted`)
   * from your custom listener to retain default closing behavior.
   *
   * Calling this method multiple times will replace previously registered handlers for provided events.
   *
   * @see {@link https://adapty.io/docs/capacitor-handling-events | Handling View Events}
   *
   * @param eventHandlers - Set of event handling callbacks. Only provided handlers will be registered or updated.
   * @returns A promise that resolves to an unsubscribe function that removes all registered listeners.
   *
   * @example
   * Register custom event handlers
   * ```typescript
   * import { createPaywallView } from '@adapty/capacitor';
   *
   * const view = await createPaywallView(paywall);
   *
   * const unsubscribe = await view.setEventHandlers({
   *   onPurchaseStarted: (product) => {
   *     console.log('Purchase started:', product.vendorProductId);
   *   },
   *   onPurchaseCompleted: (result) => {
   *     console.log('Purchase completed:', result.type);
   *     // Return true to keep default closing behavior
   *     return result.type !== 'user_cancelled';
   *   },
   *   onPurchaseFailed: (error) => {
   *     console.error('Purchase failed:', error);
   *   }
   * });
   *
   * await view.present();
   *
   * // Later, unsubscribe all handlers
   * unsubscribe();
   * ```
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

    const wrappedErrorLogEventHandlers = mapValues(eventHandlers, (handler, eventName) =>
      handler && typeof handler === 'function'
        ? withErrorContext(handler, eventName as string, 'PaywallViewController')
        : undefined,
    );

    // Merge with defaults to ensure default behavior is preserved after unsubscribe/resubscribe cycles
    const finalEventHandlers: EventHandlers = {
      ...DEFAULT_EVENT_HANDLERS,
      ...wrappedErrorLogEventHandlers,
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

  /**
   * Clears all registered event handlers.
   *
   * @remarks
   * This method removes all previously registered event handlers.
   * After calling this method, no event handlers will be active
   * until you call {@link setEventHandlers} again.
   *
   * Use this after dismiss to remove all event handlers
   *
   * @example
   * ```typescript
   * const view = await createPaywallView(paywall);
   * await view.setEventHandlers({ onPurchaseCompleted: handlePurchase });
   *
   * // Later, clear all handlers
   * view.clearEventHandlers();
   * ```
   */
  public clearEventHandlers(): void {
    Log.info(
      'clearEventHandlers',
      () => 'Clearing all event handlers for view',
      () => ({ id: this.id }),
    );

    if (this.viewEmitter) {
      this.viewEmitter.removeAllListeners();
      this.viewEmitter = null;
    }
  }
}
