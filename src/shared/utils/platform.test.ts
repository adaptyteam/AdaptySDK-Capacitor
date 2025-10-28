import { getPlatform } from './platform';
import { Capacitor } from '@capacitor/core';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: jest.fn(),
  },
}));

describe('platform utils', () => {
  it('should return platform from Capacitor', () => {
    (Capacitor.getPlatform as jest.Mock).mockReturnValue('ios');
    expect(getPlatform()).toBe('ios');

    (Capacitor.getPlatform as jest.Mock).mockReturnValue('android');
    expect(getPlatform()).toBe('android');

    (Capacitor.getPlatform as jest.Mock).mockReturnValue('web');
    expect(getPlatform()).toBe('web');
  });
});

