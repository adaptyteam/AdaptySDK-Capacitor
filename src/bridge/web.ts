import { WebPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';


import type { AdaptyCapacitorPlugin } from './definitions';

export class AdaptyCapacitorPluginWeb extends WebPlugin implements AdaptyCapacitorPlugin {
  override addListener(eventName: string, listenerFunc: (data: { data: string }) => void): Promise<PluginListenerHandle> {
    return super.addListener(eventName, listenerFunc);
  }

  override async removeAllListeners(): Promise<void> {
    await super.removeAllListeners();
  }

  private unsupported() {
    return this.unimplemented('[Adapty] Web platform is not supported');
  }

  handleMethodCall(): Promise<any> {
    return Promise.reject(this.unsupported());
  }
}
