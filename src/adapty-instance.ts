import { Adapty } from './adapty';

/**
 * The shared Adapty singleton. Extracted into its own module so UI default
 * handlers can delegate to native handler methods (openWebUrl / requestAppReview)
 * without importing the package entry point and creating an import cycle.
 */
export const adapty = new Adapty();
