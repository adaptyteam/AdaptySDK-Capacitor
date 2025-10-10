/**
 * Maps over values of an object, transforming each value using the provided function.
 *
 * @param obj - The object to map over
 * @param fn - Function to transform each value
 * @returns New object with transformed values
 */
export function mapValues<T extends Record<string, any>>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => any,
): T {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn(value, key)])) as T;
}

