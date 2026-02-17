import { Adapty } from 'adapty';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  RESTORE_PURCHASES_REQUEST,
  RESTORE_PURCHASES_RESPONSE_WITH_PREMIUM,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Restore Purchases (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(() => {
    adapty = new Adapty();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);

    if (nativeMock) {
      resetNativeModuleMock(nativeMock);
    }
  });

  it('should send RestorePurchases.Request and return profile', async () => {
    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      restore_purchases: RESTORE_PURCHASES_RESPONSE_WITH_PREMIUM,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

    const profile = await adapty.restorePurchases();

    expectNativeCall({
      nativeModule: nativeMock,
      method: 'restore_purchases',
      expectedRequest: RESTORE_PURCHASES_REQUEST,
      callIndex: 1,
    });

    // Verify response parsed to AdaptyProfile
    expect(profile.profileId).toBe('restored_profile_123');
    expect(profile.accessLevels?.['premium']).toBeDefined();
    expect(profile.accessLevels?.['premium']?.isActive).toBe(true);
  });
});
