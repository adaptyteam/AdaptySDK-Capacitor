import { AdaptyError } from '@adapty/core';

import type { Adapty } from '../adapty';
import { coderFactory } from '../coders/factory';
import { LogContext, Log } from '../logger';
import type { AdaptyFlow } from '../types';
import type { components } from '../types/api';
import { mapValues, withErrorContext } from '../utils';

import { FlowViewEmitter } from './flow-view-emitter';
import type {
  AdaptyUiView,
  CreateFlowViewParamsInput,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  FlowEventHandlers,
  AdaptyIOSPresentationStyle,
} from './types';
import { DEFAULT_FLOW_EVENT_HANDLERS } from './types';

type Req = components['requests'];

const DEFAULT_PARAMS: CreateFlowViewParamsInput = {
  prefetchProducts: true,
  loadTimeoutMs: 5000,
  enableSafeArea: true,
};

/**
 * Controller for managing flow views.
 *
 * @remarks
 * This class provides methods to present, dismiss, and handle events for flow views
 * created with the Flow Builder. Create instances using the {@link createFlowView} function
 * rather than directly constructing this class.
 *
 * @public
 */
export class FlowViewController {
  private id: string | null = null;
  private adaptyPlugin: Adapty;
  private viewEmitter: FlowViewEmitter | null = null;

  /**
   * Intended way to create a ViewController instance.
   * It prepares a native controller to be presented
   * and creates reference between native controller and JS instance
   * @internal
   */
  static async create(
    flow: AdaptyFlow,
    params: CreateFlowViewParamsInput,
    adaptyPlugin: Adapty,
  ): Promise<FlowViewController> {
    const controller = new FlowViewController(adaptyPlugin);

    const ctx = new LogContext();
    const methodKey = 'adapty_ui_create_flow_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ flow, params }));

    const flowCoder = coderFactory.createFlowCoder();
    const paramsCoder = coderFactory.createUiCreateFlowViewParamsCoder();
    const paramsWithDefaults: CreateFlowViewParamsInput = {
      ...DEFAULT_PARAMS,
      ...params,
    };

    const data: Req['AdaptyUICreateFlowView.Request'] = {
      method: methodKey,
      flow: flowCoder.encode(flow),
      ...paramsCoder.encode(paramsWithDefaults),
    };

    const result = (await controller.adaptyPlugin.handleMethodCall(
      methodKey,
      JSON.stringify(data),
      ctx,
      log,
    )) as AdaptyUiView;
    controller.id = result.id;
    controller.viewEmitter = new FlowViewEmitter(controller.id, controller.adaptyPlugin);

    await controller.setEventHandlers(DEFAULT_FLOW_EVENT_HANDLERS);

    return controller;
  }

  /**
   * Since constructors in JS cannot be async, it is not
   * preferred to create ViewControllers in direct way.
   * Consider using {@link FlowViewController.create} instead
   *
   * @internal
   */
  private constructor(adaptyPlugin: Adapty) {
    this.adaptyPlugin = adaptyPlugin;
  }

  /**
   * Presents the flow view as a modal screen.
   *
   * @remarks
   * Calling `present` on an already visible flow view will result in an error.
   * The flow will be displayed with the configured presentation style on iOS.
   * On Android, the flow is always presented as a full-screen activity.
   *
   * @param options - Optional presentation options
   * @param options.iosPresentationStyle - iOS presentation style. Available options: `'full_screen'` (default) or `'page_sheet'`. Only affects iOS platform.
   * @returns A promise that resolves when the flow is presented.
   * @throws {@link AdaptyError} if the view reference is invalid or the view is already presented.
   *
   * @example
   * Present with default full-screen style
   * ```typescript
   * import { adapty, createFlowView } from '@adapty/capacitor';
   *
   * const flow = await adapty.getFlow({ placementId: 'YOUR_PLACEMENT_ID' });
   * const view = await createFlowView(flow);
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
    const methodKey = 'adapty_ui_present_flow_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id, iosPresentationStyle: options.iosPresentationStyle }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIPresentFlowView.Request'] = {
      method: methodKey,
      id: this.id,
      ios_presentation_style: options.iosPresentationStyle ?? 'full_screen',
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
  }

  /**
   * Dismisses the flow view.
   *
   * @remarks
   * This method closes the flow and cleans up associated resources.
   * After dismissing, the view controller instance cannot be reused.
   *
   * @returns A promise that resolves when the flow is dismissed.
   * @throws {@link AdaptyError} if the view reference is invalid.
   *
   * @example
   * ```typescript
   * import { createFlowView } from '@adapty/capacitor';
   *
   * const view = await createFlowView(flow);
   * await view.present();
   * // ... later
   * await view.dismiss();
   * ```
   */
  public async dismiss(): Promise<void> {
    const ctx = new LogContext();
    const methodKey = 'adapty_ui_dismiss_flow_view';
    const log = ctx.call({ methodName: methodKey });
    log.start(() => ({ _id: this.id }));

    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIDismissFlowView.Request'] = {
      method: methodKey,
      id: this.id,
      destroy: true,
    };

    await this.adaptyPlugin.handleMethodCall(methodKey, JSON.stringify(data), ctx, log);
    this.clearEventHandlers();
  }

  /**
   * Displays a dialog to the user.
   *
   * @remarks
   * Use this method to show custom dialogs within the flow.
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
        () => 'Failed to dismiss flow',
        () => ({ error }),
      );
    }
  };

  /**
   * Registers event handlers for flow UI events.
   *
   * @remarks
   * Each event type can have only one handler — new handlers replace existing ones.
   * Default handlers are registered automatically in {@link createFlowView} (see `DEFAULT_FLOW_EVENT_HANDLERS`).
   * Only two defaults close the view; all others keep it open:
   * - `onCloseButtonPress` - closes the view (returns `true`)
   * - `onError` - closes the view (returns `true`)
   * - all other handlers keep the view open by default (return `false`),
   *   including `onAndroidSystemBack`, `onRestoreCompleted`, and `onPurchaseCompleted`
   *
   * Returning `true` from a handler closes the view; returning `false` keeps it open.
   * To retain default behavior in a custom listener, return the same value as the default
   * implementation (only `onCloseButtonPress` and `onError` close the view by default).
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
   * import { createFlowView } from '@adapty/capacitor';
   *
   * const view = await createFlowView(flow);
   *
   * const unsubscribe = await view.setEventHandlers({
   *   onPurchaseStarted: (product) => {
   *     console.log('Purchase started:', product.vendorProductId);
   *   },
   *   onPurchaseCompleted: (result) => {
   *     console.log('Purchase completed:', result.type);
   *     // Return true to close the view after purchase (default keeps it open)
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
  public async setEventHandlers(eventHandlers: Partial<FlowEventHandlers> = {}): Promise<() => void> {
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

    const viewEmitter = this.viewEmitter ?? new FlowViewEmitter(this.id, this.adaptyPlugin);
    this.viewEmitter = viewEmitter;

    const wrappedErrorLogEventHandlers = mapValues(eventHandlers, (handler, eventName) =>
      handler && typeof handler === 'function'
        ? withErrorContext(handler, eventName as string, 'FlowViewController')
        : undefined,
    );

    // Merge with defaults to ensure default behavior is preserved after unsubscribe/resubscribe cycles
    const finalEventHandlers: FlowEventHandlers = {
      ...DEFAULT_FLOW_EVENT_HANDLERS,
      ...wrappedErrorLogEventHandlers,
    };

    for (const [eventName, handler] of Object.entries(finalEventHandlers)) {
      if (handler && typeof handler === 'function') {
        try {
          await viewEmitter.addListener(eventName as keyof FlowEventHandlers, handler, this.onRequestClose);
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
   * const view = await createFlowView(flow);
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
