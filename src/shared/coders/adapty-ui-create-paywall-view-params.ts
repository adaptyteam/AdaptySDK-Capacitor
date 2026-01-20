import { Capacitor } from '@capacitor/core';
import type {
  AdaptyCustomAsset,
  CreatePaywallViewParamsInput,
  ProductPurchaseParams,
} from '../../ui-builder/types';
import type { Def } from '../types/schema';
import { AdaptyPurchaseParamsCoder } from './adapty-purchase-params';
import {
  colorToHex,
  extractBase64Data,
  formatDateUTC,
  resolveAssetId,
} from './utils';

type Model = CreatePaywallViewParamsInput;
type Serializable = {
  preload_products?: boolean;
  load_timeout?: number;
  custom_tags?: Def['AdaptyUI.CustomTagsValues'];
  custom_timers?: Def['AdaptyUI.CustomTimersValues'];
  custom_assets?: Def['AdaptyUI.CustomAssets'];
  product_purchase_parameters?: Def['AdaptyUI.ProductPurchaseParameters'];
};

export class AdaptyUICreatePaywallViewParamsCoder {
  encode(data: Model): Serializable {
    const result: Serializable = {};

    if (data.prefetchProducts !== undefined) {
      result.preload_products = data.prefetchProducts;
    }

    if (data.loadTimeoutMs !== undefined) {
      result.load_timeout = data.loadTimeoutMs / 1000;
    }

    if (data.customTags) {
      result.custom_tags = data.customTags;
    }

    if (data.customTimers) {
      result.custom_timers = this.encodeCustomTimers(data.customTimers);
    }

    if (data.customAssets) {
      result.custom_assets = this.encodeCustomAssets(data.customAssets);
    }

    if (data.productPurchaseParams) {
      result.product_purchase_parameters = this.encodeProductPurchaseParams(
        data.productPurchaseParams,
      );
    }

    return result;
  }

  private encodeCustomTimers(
    timers: NonNullable<Model['customTimers']>,
  ): Def['AdaptyUI.CustomTimersValues'] {
    const result: Record<string, string> = {};
    for (const key in timers) {
      if (Object.prototype.hasOwnProperty.call(timers, key)) {
        const date = timers[key];
        if (date instanceof Date) {
          result[key] = formatDateUTC(date);
        }
      }
    }
    return result;
  }

  private encodeCustomAssets(
    assets: Record<string, AdaptyCustomAsset>,
  ): Def['AdaptyUI.CustomAssets'] {
    const getAssetId = (asset: any): string => {
      return resolveAssetId(asset, selectPlatformValue) || '';
    };

    return Object.entries(assets)
      .map(([id, asset]): Def['AdaptyUI.CustomAssets'][number] | undefined => {
        switch (asset.type) {
          case 'image':
            return 'base64' in asset
              ? {
                  id,
                  type: 'image',
                  value: extractBase64Data(asset.base64),
                }
              : {
                  id,
                  type: 'image',
                  asset_id: getAssetId(asset),
                };

          case 'video':
            return {
              id,
              type: 'video',
              asset_id: getAssetId(asset),
            };

          case 'color': {
            const color = encodeColor(asset);
            if (!color) return undefined;
            return {
              id,
              type: 'color',
              value: color,
            };
          }

          case 'linear-gradient': {
            const { values, points = {} } = asset;
            const { x0 = 0, y0 = 0, x1 = 1, y1 = 0 } = points;

            const colorStops = values
              .map(({ p, ...colorInput }) => {
                const color = encodeColor(colorInput);
                if (!color) return undefined;
                return { color, p };
              })
              .filter(
                (v): v is { color: string; p: number } => v !== undefined,
              );

            if (colorStops.length !== values.length) return undefined;

            return {
              id,
              type: 'linear-gradient',
              values: colorStops,
              points: { x0, y0, x1, y1 },
            };
          }

          default:
            return undefined;
        }
      })
      .filter(
        (item): item is Def['AdaptyUI.CustomAssets'][number] =>
          item !== undefined,
      );
  }

  private encodeProductPurchaseParams(
    params: ProductPurchaseParams,
  ): Def['AdaptyUI.ProductPurchaseParameters'] {
    if (!params) return {};

    const purchaseParamsCoder = new AdaptyPurchaseParamsCoder();
    return Object.fromEntries(
      params.map(({ productId, params: purchaseParams }) => [
        productId.adaptyProductId,
        purchaseParamsCoder.encode(purchaseParams),
      ]),
    );
  }
}

const selectPlatformValue = <T>(spec: { ios: T; android: T }): T | undefined => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return spec.ios;
  if (platform === 'android') return spec.android;
  return undefined;
};

const encodeColor = (
  asset:
    | { argb: number }
    | { rgb: number }
    | { rgba: number },
): string | undefined => {
  if ('argb' in asset) {
    return colorToHex.fromARGB(asset.argb);
  }
  if ('rgba' in asset) {
    return colorToHex.fromRGBA(asset.rgba);
  }
  if ('rgb' in asset) {
    return colorToHex.fromRGB(asset.rgb);
  }
  return undefined;
};
