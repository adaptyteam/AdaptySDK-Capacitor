import { AdaptyIdentifyParamsCoder } from './adapty-identify-params';
import * as platformModule from '../utils/platform';

// Mock the platform module
jest.mock('../utils/platform');

const mockGetPlatform = platformModule.getPlatform as jest.MockedFunction<typeof platformModule.getPlatform>;

describe('AdaptyIdentifyParamsCoder', () => {
  const coder = new AdaptyIdentifyParamsCoder();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return undefined for empty params', () => {
    mockGetPlatform.mockReturnValue('ios');
    const result = coder.encode({});
    expect(result).toBeUndefined();
  });

  it('should return undefined for undefined params', () => {
    mockGetPlatform.mockReturnValue('ios');
    const result = coder.encode(undefined);
    expect(result).toBeUndefined();
  });

  it('should encode iOS app account token on iOS platform', () => {
    mockGetPlatform.mockReturnValue('ios');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
    };

    const result = coder.encode(params);
    expect(result).toEqual({
      app_account_token: 'ios-token-123',
    });
  });

  it('should encode Android obfuscated account ID on Android platform', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      android: {
        obfuscatedAccountId: 'android-id-456',
      },
    };

    const result = coder.encode(params);
    expect(result).toEqual({
      obfuscated_account_id: 'android-id-456',
    });
  });

  it('should only encode iOS parameters when on iOS platform', () => {
    mockGetPlatform.mockReturnValue('ios');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
      android: {
        obfuscatedAccountId: 'android-id-456',
      },
    };

    const result = coder.encode(params);
    expect(result).toEqual({
      app_account_token: 'ios-token-123',
    });
  });

  it('should only encode Android parameters when on Android platform', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
      android: {
        obfuscatedAccountId: 'android-id-456',
      },
    };

    const result = coder.encode(params);
    expect(result).toEqual({
      obfuscated_account_id: 'android-id-456',
    });
  });

  it('should ignore iOS parameters on Android platform', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
    };

    const result = coder.encode(params);
    expect(result).toBeUndefined();
  });

  it('should ignore Android parameters on iOS platform', () => {
    mockGetPlatform.mockReturnValue('ios');

    const params = {
      android: {
        obfuscatedAccountId: 'android-id-456',
      },
    };

    const result = coder.encode(params);
    expect(result).toBeUndefined();
  });

  it('should handle empty platform objects', () => {
    mockGetPlatform.mockReturnValue('ios');

    const params = {
      ios: {},
      android: {},
    };

    const result = coder.encode(params);
    expect(result).toBeUndefined();
  });
});

