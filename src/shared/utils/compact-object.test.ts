import { filterUndefined } from './compact-object';

describe('filterUndefined', () => {
  it('should remove undefined properties', () => {
    const input = {
      a: 1,
      b: undefined,
      c: 'hello',
      d: undefined,
    };

    const result = filterUndefined(input);

    expect(result).toEqual({
      a: 1,
      c: 'hello',
    });
  });

  it('should preserve all falsy values except undefined', () => {
    const input = {
      null_value: null,
      false_value: false,
      zero_value: 0,
      empty_string: '',
      undefined_value: undefined,
      truthy_value: 'test',
    };

    const result = filterUndefined(input);

    expect(result).toEqual({
      null_value: null,
      false_value: false,
      zero_value: 0,
      empty_string: '',
      truthy_value: 'test',
    });
  });

  it('should handle empty object', () => {
    const input = {};
    const result = filterUndefined(input);
    expect(result).toEqual({});
  });

  it('should handle object with all undefined values', () => {
    const input = {
      a: undefined,
      b: undefined,
      c: undefined,
    };

    const result = filterUndefined(input);
    expect(result).toEqual({});
  });

  it('should handle object with no undefined values', () => {
    const input = {
      a: 1,
      b: 'test',
      c: true,
      d: { nested: 'object' },
    };

    const result = filterUndefined(input);
    expect(result).toEqual(input);
  });

  it('should preserve nested objects (without deep filtering)', () => {
    const input = {
      a: 1,
      b: undefined,
      nested: {
        x: 1,
        y: undefined, // This should remain as the function doesn't do deep filtering
      },
    };

    const result = filterUndefined(input);

    expect(result).toEqual({
      a: 1,
      nested: {
        x: 1,
        y: undefined,
      },
    });
  });

  it('should preserve array values', () => {
    const input = {
      array: [1, undefined, 'test', null],
      b: undefined,
      c: 'value',
    };

    const result = filterUndefined(input);

    expect(result).toEqual({
      array: [1, undefined, 'test', null],
      c: 'value',
    });
  });

  it('should maintain type structure', () => {
    interface TestType {
      required: string;
      optional?: number;
      nullable: string | null;
    }

    const input: TestType = {
      required: 'test',
      optional: undefined,
      nullable: null,
    };

    const result = filterUndefined(input);

    // Type check - result should still be of TestType
    expect(result).toEqual({
      required: 'test',
      nullable: null,
    });

    // Verify properties exist or don't exist
    expect('required' in result).toBe(true);
    expect('optional' in result).toBe(false);
    expect('nullable' in result).toBe(true);
  });
});
