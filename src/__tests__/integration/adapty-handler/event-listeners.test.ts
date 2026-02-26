import { Adapty } from 'adapty';
import type { AdaptyError } from 'shared/adapty-error';
import type { AdaptyInstallationDetails } from 'shared/types';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  INSTALLATION_DETAILS_SUCCESS,
  INSTALLATION_DETAILS_FAIL,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  emitNativeEvent,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Event Listeners (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('addListener', () => {
    it('should receive onInstallationDetailsSuccess event', async () => {
      const callback = jest.fn();

      await adapty.addListener('onInstallationDetailsSuccess', callback);

      // Emit native event
      emitNativeEvent({
        eventName: 'on_installation_details_success',
        eventData: INSTALLATION_DETAILS_SUCCESS,
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);

      const { details }: { details: AdaptyInstallationDetails } = callback.mock.calls[0][0];
      expect(details.installId).toBe('some-install-id');
      expect(details.appLaunchCount).toBe(8);
      expect(details.payload).toBe('{}');
      expect(details.installTime).toBeInstanceOf(Date);
    });

    it('should receive onInstallationDetailsFail event', async () => {
      const callback = jest.fn();

      await adapty.addListener('onInstallationDetailsFail', callback);

      // Emit native event
      emitNativeEvent({
        eventName: 'on_installation_details_fail',
        eventData: INSTALLATION_DETAILS_FAIL,
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);

      const { error }: { error: AdaptyError } = callback.mock.calls[0][0];
      expect(error.adaptyCode).toBe(2004);
      expect(error.message).toBe('Failed to fetch installation details');
    });

    it('should support multiple listeners for the same event', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await adapty.addListener('onInstallationDetailsSuccess', callback1);
      await adapty.addListener('onInstallationDetailsSuccess', callback2);

      // Emit native event
      emitNativeEvent({
        eventName: 'on_installation_details_success',
        eventData: INSTALLATION_DETAILS_SUCCESS,
      });

      // Wait for events to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should allow listener to be removed individually', async () => {
      const callback = jest.fn();

      const subscription = await adapty.addListener('onInstallationDetailsSuccess', callback);

      // Remove listener before emitting event
      await subscription.remove();

      // Emit native event
      emitNativeEvent({
        eventName: 'on_installation_details_success',
        eventData: INSTALLATION_DETAILS_SUCCESS,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Callback should NOT be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all event listeners', async () => {
      const successCallback = jest.fn();
      const failCallback = jest.fn();

      await adapty.addListener('onInstallationDetailsSuccess', successCallback);
      await adapty.addListener('onInstallationDetailsFail', failCallback);

      // Remove all listeners
      await adapty.removeAllListeners();

      // Emit native events
      emitNativeEvent({
        eventName: 'on_installation_details_success',
        eventData: INSTALLATION_DETAILS_SUCCESS,
      });

      emitNativeEvent({
        eventName: 'on_installation_details_fail',
        eventData: INSTALLATION_DETAILS_FAIL,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Neither callback should be called
      expect(successCallback).not.toHaveBeenCalled();
      expect(failCallback).not.toHaveBeenCalled();
    });
  });
});
