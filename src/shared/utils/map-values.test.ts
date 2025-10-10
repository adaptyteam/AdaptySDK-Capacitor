import { mapValues } from './map-values';

describe('mapValues', () => {
  it('should transform all values using the provided function', () => {
    const input = {
      a: 1,
      b: 2,
      c: 3,
    };

    const result = mapValues(input, (value) => value * 2);

    expect(result).toEqual({
      a: 2,
      b: 4,
      c: 6,
    });
  });

  it('should pass both value and key to the transformer function', () => {
    const input = {
      foo: 10,
      bar: 20,
    };

    const result = mapValues(input, (value, key) => `${key}:${value}`);

    expect(result).toEqual({
      foo: 'foo:10',
      bar: 'bar:20',
    });
  });

  it('should handle empty object', () => {
    const input = {};
    const result = mapValues(input, (value) => value);
    expect(result).toEqual({});
  });

  it('should preserve object structure with mixed types', () => {
    const input = {
      str: 'hello',
      num: 42,
      bool: true,
      obj: { nested: 'value' },
      arr: [1, 2, 3],
    };

    const result = mapValues(input, (value) => value);

    expect(result).toEqual(input);
  });

  it('should handle transformation to different types', () => {
    const input = {
      a: 1,
      b: 2,
      c: 3,
    };

    const result = mapValues(input, (value, key) => ({
      original: value,
      key: key,
    }));

    expect(result).toEqual({
      a: { original: 1, key: 'a' },
      b: { original: 2, key: 'b' },
      c: { original: 3, key: 'c' },
    });
  });

  it('should handle nullable values', () => {
    const input = {
      a: null,
      b: undefined,
      c: 'value',
    };

    const result = mapValues(input, (value) => (value === null ? 'null' : value === undefined ? 'undefined' : value));

    expect(result).toEqual({
      a: 'null',
      b: 'undefined',
      c: 'value',
    });
  });

  it('should work with function values', () => {
    const fn1 = () => 'one';
    const fn2 = () => 'two';

    const input = {
      func1: fn1,
      func2: fn2,
    };

    const result = mapValues(input, (fn, key) => {
      if (typeof fn === 'function') {
        return () => `${key}:${fn()}`;
      }
      return fn;
    });

    expect(typeof result.func1).toBe('function');
    expect(typeof result.func2).toBe('function');
    expect(result.func1()).toBe('func1:one');
    expect(result.func2()).toBe('func2:two');
  });

  it('should maintain type structure', () => {
    interface TestType {
      id: number;
      name: string;
      active: boolean;
    }

    const input: TestType = {
      id: 1,
      name: 'Test',
      active: true,
    };

    const result = mapValues(input, (value, key) => {
      if (key === 'id') return (value as number) * 10;
      if (key === 'name') return (value as string).toUpperCase();
      return value;
    });

    expect(result).toEqual({
      id: 10,
      name: 'TEST',
      active: true,
    });
  });

  it('should handle objects with symbol keys gracefully', () => {
    const sym = Symbol('test');
    const input = {
      regular: 'value',
      [sym]: 'symbol-value',
    } as any;

    // Object.entries does not include symbol keys
    const result = mapValues(input, (value) => `transformed:${value}`);

    expect(result.regular).toBe('transformed:value');
    // Symbol keys are not transformed by Object.entries
    expect(result[sym]).toBeUndefined();
  });

  it('should not mutate the original object', () => {
    const input = {
      a: 1,
      b: 2,
    };

    const inputCopy = { ...input };

    mapValues(input, (value) => value * 2);

    expect(input).toEqual(inputCopy);
  });
});

