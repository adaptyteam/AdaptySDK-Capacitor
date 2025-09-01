import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyCapacitorPlugin as AdaptyCapacitorPluginType } from './definitions';

export const mockAdaptyCapacitorPlugin = {
  AdaptyCapacitorPlugin: {
    handleMethodCall: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn().mockImplementation(() => {
      const mockHandle: PluginListenerHandle = {
        remove: jest.fn().mockResolvedValue(undefined),
      };
      return Promise.resolve(mockHandle);
    }),
  } satisfies AdaptyCapacitorPluginType,
};

export function createMockAdaptyCapacitorPlugin(): {
  mockPluginHandle: PluginListenerHandle;
  mockAddListener: jest.MockedFunction<any>;
} {
  const mockPluginHandle: PluginListenerHandle = {
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockAddListener = jest.fn().mockResolvedValue(mockPluginHandle);

  return {
    mockPluginHandle,
    mockAddListener,
  };
}
