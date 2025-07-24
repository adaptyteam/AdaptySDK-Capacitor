import { merge } from "ts-deepmerge";

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
  return merge(defaults, options) as TResult;
}

