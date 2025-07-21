import { registerPlugin } from '@capacitor/core';

import type { AdaptyCapacitorPlugin as AdaptyCapacitorPluginType } from './definitions';

export const AdaptyCapacitorPlugin = registerPlugin<AdaptyCapacitorPluginType>('AdaptyCapacitorPlugin', {
  web: () => import('./web').then((m) => new m.AdaptyCapacitorPluginWeb()),
});
