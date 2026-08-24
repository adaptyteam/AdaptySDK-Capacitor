import { adapty } from '@adapty/capacitor';

/**
 * Third-party attribution providers exercised by the attribution buttons.
 * The string is what the SDK forwards as the `provider` argument.
 */
export const EXTERNAL_ATTRIBUTION_PROVIDERS = ['adjust', 'appsflyer', 'branch'] as const;

export type ExternalAttributionProvider = (typeof EXTERNAL_ATTRIBUTION_PROVIDERS)[number];

/**
 * Display labels for the attribution buttons. The provider strings above are
 * wire values sent to the SDK, not UI copy — "AppsFlyer" cannot be derived
 * from them.
 */
export const EXTERNAL_ATTRIBUTION_LABELS: Record<ExternalAttributionProvider, string> = {
  adjust: 'Adjust',
  appsflyer: 'AppsFlyer',
  branch: 'Branch',
};

/**
 * Payload shared by every third-party provider button — they only ever
 * differed by the provider name, so it lives in one place.
 */
export const PROVIDER_ATTRIBUTION_PAYLOAD: Record<string, unknown> = {
  data: {
    af_message: 'organic install',
    af_status: 'Organic',
    is_first_launch: 'true',
  },
  status: 'success',
  type: 'onInstallConversionDataLoaded',
};

/** Payload for the hand-rolled `custom` provider button in "Other Actions". */
export const CUSTOM_ATTRIBUTION_PAYLOAD: Record<string, unknown> = {
  status: 'non_organic',
  channel: 'Google Ads',
  campaign: 'Adapty Web Test',
  ad_group: 'adapty ad_group',
  creative: 'test_creative',
};

/**
 * Renamed from `updateAttribution` in @adapty/capacitor 4.1.0; the second
 * field is now the attribution provider rather than a free-form source.
 */
export function sendProviderAttribution(provider: ExternalAttributionProvider): Promise<void> {
  return adapty.updateExternalAttribution({
    attribution: PROVIDER_ATTRIBUTION_PAYLOAD,
    provider,
  });
}

export function sendCustomAttribution(): Promise<void> {
  return adapty.updateExternalAttribution({
    attribution: CUSTOM_ATTRIBUTION_PAYLOAD,
    provider: 'custom',
  });
}
