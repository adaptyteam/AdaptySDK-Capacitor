import type { IPlatformAdapter, ISdkMetadataAdapter, PlatformOS } from '@adapty/core';
import { Capacitor } from '@capacitor/core';

import VERSION from './version';

/**
 * Capacitor implementation of IPlatformAdapter
 * Wraps Capacitor.getPlatform() to detect current OS
 */
export class CapacitorPlatformAdapter implements IPlatformAdapter {
  get OS(): PlatformOS {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      return platform;
    }
    if (platform === 'web') {
      return 'web';
    }
    return 'unknown';
  }
}

/**
 * Capacitor implementation of ISdkMetadataAdapter
 * Provides SDK name and version metadata
 */
export class CapacitorSdkMetadataAdapter implements ISdkMetadataAdapter {
  get sdkName(): string {
    return 'capacitor';
  }

  get sdkVersion(): string {
    return VERSION;
  }
}
