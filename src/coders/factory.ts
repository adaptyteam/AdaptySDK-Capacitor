import { CoderFactory } from '@adapty/core';

import { CapacitorPlatformAdapter, CapacitorSdkMetadataAdapter } from '../adapters';

/**
 * Singleton instance of CoderFactory for Capacitor SDK
 * Initialized with Capacitor platform and SDK metadata adapters
 */
export const coderFactory = new CoderFactory({
  platform: new CapacitorPlatformAdapter(),
  sdkMetadata: new CapacitorSdkMetadataAdapter(),
});
