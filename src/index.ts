import { registerPlugin } from '@capacitor/core';

import type { AdaptyCapacitorPluginPlugin } from './definitions';

const AdaptyCapacitorPlugin = registerPlugin<AdaptyCapacitorPluginPlugin>('AdaptyCapacitorPlugin', {
  web: () => import('./web').then((m) => new m.AdaptyCapacitorPluginWeb()),
});

export * from './definitions';
export * from './adapty';
export type * from './shared';
export { AdaptyCapacitorPlugin };
