import type { AdaptyPurchaseResult } from '../types';
import type { Def } from '../types/schema';
import type { Properties } from './types';
import { SimpleCoder } from './coder';
import { AdaptyProfileCoder } from './adapty-profile';
import { getPlatform } from '../utils/platform';

type Model = AdaptyPurchaseResult;
type Serializable = Def['AdaptyPurchaseResult'];

export class AdaptyPurchaseResultCoder extends SimpleCoder<
  Model,
  Serializable
> {
  protected properties: Properties<Model, Serializable> = {
    type: {
      key: 'type',
      required: true,
      type: 'string',
    },
  };

  override decode(data: Serializable): Model {
    const baseResult = super.decode(data);
    if (baseResult.type === 'success') {
      if (!data.profile) {
        throw new Error(
          'Profile is required for success type of purchase result',
        );
      }
      const platform = getPlatform();
      const anyData = data as any;
      return {
        ...baseResult,
        profile: new AdaptyProfileCoder().decode(data.profile),
        ...(platform === 'ios' && anyData.apple_jws_transaction
          ? { ios: { jwsTransaction: anyData.apple_jws_transaction } }
          : {}),
        ...(platform === 'android' && anyData.google_purchase_token
          ? { android: { purchaseToken: anyData.google_purchase_token } }
          : {}),
      };
    }
    return baseResult;
  }

  override encode(data: Model): Serializable {
    const { type } = data;

    if (type === 'success') {
      if (!('profile' in data)) {
        throw new Error(
          'Profile is required for success type of purchase result',
        );
      }

      const platform = getPlatform();
      const result: any = {
        type: 'success',
        profile: new AdaptyProfileCoder().encode(data.profile),
      };
      if (platform === 'ios' && data.ios?.jwsTransaction) {
        result.apple_jws_transaction = data.ios.jwsTransaction;
      }
      if (platform === 'android' && data.android?.purchaseToken) {
        result.google_purchase_token = data.android.purchaseToken;
      }
      return result;
    }

    return super.encode({ type });
  }
}
