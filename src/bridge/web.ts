import { WebPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyProfile, AdaptyInstallationDetails } from '../shared/types';

import type { AdaptyCapacitorPlugin } from './definitions';

export class AdaptyCapacitorPluginWeb extends WebPlugin implements AdaptyCapacitorPlugin {
  override addListener(eventName: 'onLatestProfileLoad', listenerFunc: (data: { profile: AdaptyProfile }) => void): Promise<PluginListenerHandle>;
  override addListener(eventName: 'onInstallationDetailsSuccess', listenerFunc: (data: { details: AdaptyInstallationDetails }) => void): Promise<PluginListenerHandle>;
  override addListener(eventName: 'onInstallationDetailsFail', listenerFunc: (data: { error: any }) => void): Promise<PluginListenerHandle>;
  override addListener(eventName: any, listenerFunc: any): Promise<PluginListenerHandle> {
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
