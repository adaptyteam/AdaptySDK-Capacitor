import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}

