/**
 * Removes undefined properties from an object, preserving the original type structure
 * @param obj - Source object with potentially undefined values
 * @returns Object with undefined values filtered out
 */
export function filterUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as T;
} 