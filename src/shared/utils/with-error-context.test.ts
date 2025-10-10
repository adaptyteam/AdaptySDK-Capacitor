import { withErrorContext } from './with-error-context';

describe('withErrorContext', () => {
  it('should return the callback result when no error is thrown', () => {
    const callback = (a: number, b: number) => a + b;
    const wrapped = withErrorContext(callback, 'testHandler', 'TestSource');

    const result = wrapped(2, 3);

    expect(result).toBe(5);
  });

  it('should pass through all arguments to the original callback', () => {
    const mockCallback = jest.fn((a: string, b: number, c: boolean) => `${a}-${b}-${c}`);
    const wrapped = withErrorContext(mockCallback, 'testHandler', 'TestSource');

    wrapped('test', 42, true);

    expect(mockCallback).toHaveBeenCalledWith('test', 42, true);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should preserve this context', () => {
    const obj = {
      value: 42,
      getValue: function () {
        return this.value;
      },
    };

    const wrapped = withErrorContext(obj.getValue, 'getValue', 'TestObject');

    const result = wrapped.call(obj);

    expect(result).toBe(42);
  });

  it('should wrap Error exceptions with context message', () => {
    const originalError = new Error('Original error message');
    const callback = () => {
      throw originalError;
    };

    const wrapped = withErrorContext(callback, 'failingHandler', 'ErrorSource');

    expect(() => wrapped()).toThrow();

    try {
      wrapped();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Unhandled exception in user's handler in ErrorSource.failingHandler",
      );
      expect((error as any).originalError).toBe(originalError);
    }
  });

  it('should handle non-Error exceptions', () => {
    const callback = () => {
      throw 'string error';
    };

    const wrapped = withErrorContext(callback, 'handler', 'Source');

    try {
      wrapped();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Unhandled exception in user's handler in Source.handler");
      expect((error as any).originalError).toBe('string error');
    }
  });

  it('should handle object exceptions', () => {
    const objectError = { code: 123, message: 'Custom error object' };
    const callback = () => {
      throw objectError;
    };

    const wrapped = withErrorContext(callback, 'handler', 'Source');

    try {
      wrapped();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as any).originalError).toBe(objectError);
    }
  });

  it('should format error message with source and handlerName', () => {
    const callback = () => {
      throw new Error('test');
    };

    const wrapped = withErrorContext(callback, 'onPurchaseCompleted', 'PaywallViewController');

    try {
      wrapped();
      fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toBe(
        "Unhandled exception in user's handler in PaywallViewController.onPurchaseCompleted",
      );
    }
  });

  it('should handle callbacks with no arguments', () => {
    const callback = () => 'no args';
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    const result = wrapped();

    expect(result).toBe('no args');
  });

  it('should handle callbacks that return undefined', () => {
    const callback = () => undefined;
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    const result = wrapped();

    expect(result).toBeUndefined();
  });

  it('should handle callbacks that return null', () => {
    const callback = () => null;
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    const result = wrapped();

    expect(result).toBeNull();
  });

  it('should handle callbacks that return objects', () => {
    const returnValue = { success: true, data: [1, 2, 3] };
    const callback = () => returnValue;
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    const result = wrapped();

    expect(result).toBe(returnValue);
  });

  it('should handle async callbacks', async () => {
    const callback = async (value: number) => {
      return Promise.resolve(value * 2);
    };

    const wrapped = withErrorContext(callback, 'asyncHandler', 'AsyncSource');

    const result = await wrapped(21);

    expect(result).toBe(42);
  });

  it('should handle async callbacks that reject', async () => {
    const callback = async () => {
      throw new Error('Async error');
    };

    const wrapped = withErrorContext(callback, 'asyncHandler', 'AsyncSource');

    // Note: withErrorContext wraps synchronous try/catch, but doesn't wrap Promise rejections
    // The callback executes successfully and returns a rejected Promise
    // To properly handle async errors, the caller needs to catch the rejection
    await expect(wrapped()).rejects.toThrow('Async error');
  });

  it('should be callable multiple times', () => {
    let counter = 0;
    const callback = () => ++counter;
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    expect(wrapped()).toBe(1);
    expect(wrapped()).toBe(2);
    expect(wrapped()).toBe(3);
  });

  it('should handle callbacks with complex argument types', () => {
    interface ComplexArg {
      id: number;
      data: { nested: string };
      fn: () => void;
    }

    const callback = (arg: ComplexArg) => arg.data.nested;
    const wrapped = withErrorContext(callback, 'handler', 'Source');

    const complexArg: ComplexArg = {
      id: 1,
      data: { nested: 'value' },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      fn: () => {},
    };

    const result = wrapped(complexArg);

    expect(result).toBe('value');
  });
});

