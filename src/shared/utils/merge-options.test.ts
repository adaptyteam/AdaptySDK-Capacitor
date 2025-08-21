import { mergeOptions } from './merge-options';

describe('mergeOptions', () => {
  describe('basic merging', () => {
    it('should merge simple objects', () => {
      const defaults = { a: 1, b: 2 };
      const options = { b: 3, c: 4 };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should use defaults when options is empty', () => {
      const defaults = { a: 1, b: 2 };
      const options = {};
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual(defaults);
    });

    it('should use options when defaults is empty', () => {
      const defaults = {};
      const options = { a: 1, b: 2 };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual(options);
    });

    it('should return empty object when both are empty', () => {
      const result = mergeOptions({}, {});
      
      expect(result).toEqual({});
    });
  });

  describe('deep merging', () => {
    it('should merge nested objects', () => {
      const defaults = {
        config: {
          timeout: 5000,
          retries: 3,
        },
        debug: true,
      };
      
      const options = {
        config: {
          timeout: 10000,
        },
        endpoint: 'https://api.example.com',
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        config: {
          timeout: 10000,
          retries: 3,
        },
        debug: true,
        endpoint: 'https://api.example.com',
      });
    });

    it('should merge deeply nested objects', () => {
      const defaults = {
        level1: {
          level2: {
            level3: {
              value: 'default',
              other: 42,
            },
          },
        },
      };
      
      const options = {
        level1: {
          level2: {
            level3: {
              value: 'custom',
            },
          },
        },
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: 'custom',
              other: 42,
            },
          },
        },
      });
    });
  });

  describe('array handling', () => {
    it('should merge arrays by concatenating them', () => {
      const defaults = { items: [1, 2, 3] };
      const options = { items: [4, 5] };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({ items: [1, 2, 3, 4, 5] });
    });

    it('should handle arrays in nested objects', () => {
      const defaults = {
        config: {
          tags: ['default'],
          settings: { values: [1, 2] },
        },
      };
      
      const options = {
        config: {
          tags: ['custom', 'new'],
        },
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        config: {
          tags: ['default', 'custom', 'new'],
          settings: { values: [1, 2] },
        },
      });
    });
  });

  describe('null and undefined handling', () => {
    it('should handle null values', () => {
      const defaults = { a: 1, b: null };
      const options = { a: null, c: 3 };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({ a: null, b: null, c: 3 });
    });

    it('should handle undefined values', () => {
      const defaults = { a: 1, b: undefined };
      const options = { a: undefined, c: 3 };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({ a: undefined, b: undefined, c: 3 });
    });

    it('should handle null in nested objects', () => {
      const defaults = {
        config: {
          value: 'default',
          nullable: null,
        },
      };
      
      const options = {
        config: {
          value: null,
        },
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        config: {
          value: null,
          nullable: null,
        },
      });
    });
  });

  describe('primitive value types', () => {
    it('should handle different primitive types', () => {
      const defaults = {
        string: 'default',
        number: 42,
        boolean: false,
        bigint: BigInt(123),
      };
      
      const options = {
        string: 'custom',
        number: 100,
        boolean: true,
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        string: 'custom',
        number: 100,
        boolean: true,
        bigint: BigInt(123),
      });
    });

    it('should handle symbol values', () => {
      const sym1 = Symbol('default');
      const sym2 = Symbol('custom');
      
      const defaults = { symbol: sym1 };
      const options = { symbol: sym2 };
      
      const result = mergeOptions(options, defaults);
      
      expect(result.symbol).toBe(sym2);
    });
  });

  describe('complex scenarios', () => {
    it('should merge complex configuration objects', () => {
      const defaults = {
        api: {
          baseUrl: 'https://default.com',
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DefaultAgent/1.0',
          },
        },
        features: {
          analytics: true,
          debug: false,
        },
        endpoints: ['/users', '/posts'],
      };
      
      const options = {
        api: {
          baseUrl: 'https://custom.com',
          headers: {
            'Authorization': 'Bearer token',
            'User-Agent': 'CustomAgent/2.0',
          },
        },
        features: {
          debug: true,
        },
        endpoints: ['/custom'],
      };
      
      const result = mergeOptions(options, defaults);
      
      expect(result).toEqual({
        api: {
          baseUrl: 'https://custom.com',
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
            'User-Agent': 'CustomAgent/2.0',
          },
        },
        features: {
          analytics: true,
          debug: true,
        },
        endpoints: ['/users', '/posts', '/custom'],
      });
    });

    it('should handle function values', () => {
      const defaultFn = () => 'default';
      const customFn = () => 'custom';
      
      const defaults = { callback: defaultFn };
      const options = { callback: customFn };
      
      const result = mergeOptions(options, defaults);
      
      expect(result.callback).toBe(customFn);
      expect(result.callback()).toBe('custom');
    });

    it('should handle Date objects', () => {
      const defaultDate = new Date('2023-01-01');
      const customDate = new Date('2024-01-01');
      
      const defaults = { timestamp: defaultDate };
      const options = { timestamp: customDate };
      
      const result = mergeOptions(options, defaults);
      
      expect(result.timestamp).toBe(customDate);
    });
  });

  describe('type safety', () => {
    interface TestConfig {
      name: string;
      count: number;
      enabled: boolean;
    }

    it('should maintain type safety with generics', () => {
      const defaults = { name: 'default', count: 0, enabled: false };
      const options = { name: 'test', count: 5 };
      
      const result = mergeOptions<TestConfig>(options, defaults);
      
      expect(result.name).toBe('test');
      expect(result.count).toBe(5);
      expect(result.enabled).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle objects with prototype pollution attempts', () => {
      const maliciousOptions = JSON.parse('{"__proto__": {"polluted": true}}');
      const defaults = { safe: true };
      
      const result = mergeOptions(maliciousOptions, defaults);
      
      expect(result.safe).toBe(true);
      expect((result as any).__proto__.polluted).toBeUndefined();
    });

    it('should handle circular references in objects', () => {
      const defaults = { a: 1 };
      const options: any = { b: 2 };
      options.circular = options;
      
      // Should not throw error due to circular reference
      expect(() => mergeOptions(options, defaults)).toThrow();
    });

    it('should handle very large objects', () => {
      const largeDefaults: any = {};
      const largeOptions: any = {};
      
      for (let i = 0; i < 1000; i++) {
        largeDefaults[`key${i}`] = `default${i}`;
        if (i % 2 === 0) {
          largeOptions[`key${i}`] = `custom${i}`;
        }
      }
      
      const result = mergeOptions(largeOptions, largeDefaults);
      
      expect(Object.keys(result)).toHaveLength(1000);
      expect(result.key0).toBe('custom0');
      expect(result.key1).toBe('default1');
    });
  });
});
