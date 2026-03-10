import type { Adapty } from 'adapty';
import { Log } from 'logger';

/**
 * Cleans up Adapty instance by removing all listeners
 * and resetting static Log state to prevent leaks between tests.
 */
export async function cleanupAdapty(adapty: Adapty | null | undefined): Promise<void> {
  if (!adapty) return;
  await adapty.removeAllListeners();
  Log.logLevel = null;
}
