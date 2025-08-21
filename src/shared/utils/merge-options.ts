/**
 * Checks if a value is a plain object (not an array, null, Date, etc.)
 */
function isPlainObject(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merge implementation that replaces arrays and merges objects
 */
function deepMerge(target: any, source: any, seen = new Set()): any {
  // Handle null/undefined cases
  if (source === null || source === undefined) {
    return source;
  }
  
  if (target === null || target === undefined) {
    return source;
  }

  // Handle arrays - replace them (source overwrites target)
  if (Array.isArray(source)) {
    return source;
  }

  // If target is array but source is not, return source
  if (Array.isArray(target)) {
    return source;
  }

  // Handle plain objects - merge recursively
  if (isPlainObject(target) && isPlainObject(source)) {
    // Check for circular references
    if (seen.has(source) || seen.has(target)) {
      throw new Error('Converting circular structure to JSON');
    }
    
    seen.add(source);
    seen.add(target);
    
    const result: any = {};
    
    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.keys(target),
      ...Object.keys(source)
    ]);

    for (const key of allKeys) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (key in source) {
        if (key in target) {
          // Check for circular reference in values
          if (seen.has(source[key]) || seen.has(target[key])) {
            throw new Error('Converting circular structure to JSON');
          }
          // Recursively merge if key exists in both
          result[key] = deepMerge(target[key], source[key], seen);
        } else {
          // Check for circular reference in source value
          if (seen.has(source[key])) {
            throw new Error('Converting circular structure to JSON');
          }
          // Use source value if key only exists in source
          result[key] = source[key];
        }
      } else {
        // Check for circular reference in target value
        if (seen.has(target[key])) {
          throw new Error('Converting circular structure to JSON');
        }
        // Use target value if key only exists in target
        result[key] = target[key];
      }
    }

    seen.delete(source);
    seen.delete(target);

    return result;
  }

  // For all other cases (primitives, functions, dates, etc.), return source
  return source;
}

/**
 * Universal method for merging options with defaults
 * @param options - input options
 * @param defaults - default values
 * @returns merged object with TResult type
 */
export function mergeOptions<TResult = any>(
  options: any,
  defaults: any
): TResult {
  return deepMerge(defaults, options) as TResult;
}

