import { registerPlugin } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from './definitions';

const AdaptyCapacitorPlugin = registerPlugin<AdaptyCapacitorPlugin>('AdaptyCapacitorPlugin', {
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
