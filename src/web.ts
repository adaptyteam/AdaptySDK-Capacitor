import { WebPlugin } from '@capacitor/core';

import type { AdaptyCapacitorPluginPlugin } from './definitions';

export class AdaptyCapacitorPluginWeb extends WebPlugin implements AdaptyCapacitorPluginPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
