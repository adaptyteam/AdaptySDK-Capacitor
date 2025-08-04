export const VendorStore = Object.freeze({
  AppStore: 'app_store',
  PlayStore: 'play_store',
  Adapty: 'adapty',
});
export type VendorStore = (typeof VendorStore)[keyof typeof VendorStore];

export const OfferType = Object.freeze({
  FreeTrial: 'free_trial',
  PayAsYouGo: 'pay_as_you_go',
  PayUpFront: 'pay_up_front',
});
export type OfferType = (typeof OfferType)[keyof typeof OfferType];

export const CancellationReason = Object.freeze({
  VolountarilyCancelled: 'voluntarily_cancelled',
  BillingError: 'billing_error',
  Refund: 'refund',
  PriceIncrease: 'price_increase',
  ProductWasNotAvailable: 'product_was_not_available',
  Unknown: 'unknown',
});
export type CancellationReason =
  (typeof CancellationReason)[keyof typeof CancellationReason];

export const Gender = Object.freeze({
  Female: 'f',
  Male: 'm',
  Other: 'o',
});
export type Gender = (typeof Gender)[keyof typeof Gender];

export const AppTrackingTransparencyStatus = Object.freeze({
  NotDetermined: 0,
  Restricted: 1,
  Denied: 2,
  Authorized: 3,
  Unknown: 4,
});
export type AppTrackingTransparencyStatus =
  (typeof AppTrackingTransparencyStatus)[keyof typeof AppTrackingTransparencyStatus];

export const ProductPeriod = Object.freeze({
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Year: 'year',
});
export type ProductPeriod = (typeof ProductPeriod)[keyof typeof ProductPeriod];

export const RefundPreference = Object.freeze({
  NoPreference: 'no_preference',
  Grant: 'grant',
  Decline: 'decline',
});
export type RefundPreference =
  (typeof RefundPreference)[keyof typeof RefundPreference]; 