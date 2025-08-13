import { FetchPolicy } from './shared/types/inputs';
import type { AdaptyDefaultOptions } from './types/configs';

export const defaultAdaptyOptions: AdaptyDefaultOptions = {
  get_paywall: {
    params: {
      fetchPolicy: FetchPolicy.ReloadRevalidatingCacheData,
      loadTimeoutMs: 5000,
    },
  },
  get_paywall_for_default_audience: {
    params: {
      fetchPolicy: FetchPolicy.ReloadRevalidatingCacheData,
    },
  },
  get_onboarding: {
    params: {
      fetchPolicy: FetchPolicy.ReloadRevalidatingCacheData,
      loadTimeoutMs: 5000,
    },
  },
  get_onboarding_for_default_audience: {
    params: {
      fetchPolicy: FetchPolicy.ReloadRevalidatingCacheData,
      loadTimeoutMs: 5000,
    },
  },
};
