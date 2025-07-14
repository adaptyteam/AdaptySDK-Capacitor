import { Adapty } from '../../adapty';
import type { AdaptyPaywall } from '../types';
import type { AdaptyUiView, CreatePaywallViewParamsInput, AdaptyUiDialogConfig, AdaptyUiDialogActionType } from './types';
import { AdaptyPaywallCoder } from '../coders/adapty-paywall';
import { AdaptyError } from '../adapty-error';
import type { components } from '../types/api';

type Req = components['requests'];

/**
 * Provides methods to control created paywall view
 * @public
 */
export class ViewController {
  private id: string | null = null;
  private adaptyPlugin: Adapty;

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
  ): Promise<ViewController> {
    const controller = new ViewController(adaptyPlugin);

    const coder = new AdaptyPaywallCoder();
    const data: Req['AdaptyUICreatePaywallView.Request'] = {
      method: 'adapty_ui_create_paywall_view',
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
          if (timerInfo.hasOwnProperty(key)) {
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

    const result = await controller.adaptyPlugin.handleMethodCall('adapty_ui_create_paywall_view', data) as AdaptyUiView;
    controller.id = result.id;
    
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
    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIPresentPaywallView.Request'] = {
      method: 'adapty_ui_present_paywall_view',
      id: this.id,
    };

    await this.adaptyPlugin.handleMethodCall('adapty_ui_present_paywall_view', data);
  }

  /**
   * Dismisses a paywall view
   *
   * @throws {AdaptyError}
   */
  public async dismiss(): Promise<void> {
    if (this.id === null) {
      throw new AdaptyError({
        adaptyCode: 2002,
        message: 'No view reference',
      });
    }

    const data: Req['AdaptyUIDismissPaywallView.Request'] = {
      method: 'adapty_ui_dismiss_paywall_view',
      id: this.id,
      destroy: false,
    };

    await this.adaptyPlugin.handleMethodCall('adapty_ui_dismiss_paywall_view', data);
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
      method: 'adapty_ui_show_dialog',
      id: this.id,
      configuration: dialogConfig,
    };

    return await this.adaptyPlugin.handleMethodCall('adapty_ui_show_dialog', data);
  }
} 