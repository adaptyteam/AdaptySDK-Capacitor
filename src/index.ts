import { registerPlugin } from '@capacitor/core';

import type { AdaptyCapacitorPluginPlugin } from './definitions';

const AdaptyCapacitorPlugin = registerPlugin<AdaptyCapacitorPluginPlugin>('AdaptyCapacitorPlugin', {
  web: () => import('./web').then((m) => new m.AdaptyCapacitorPluginWeb()),
});

export * from './definitions';
export * from './adapty';
export type * from './shared';
export { AdaptyCapacitorPlugin };
export { createPaywallView, ViewController } from './ui-builder/index';
export type {
  CreatePaywallViewParamsInput,
  AdaptyUiView,
  AdaptyUiDialogConfig,
  AdaptyUiDialogActionType,
  EventHandlers,
} from './ui-builder/index';
