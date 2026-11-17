// The app wvd drives: this example by default. WVD_APP_ROOT points it at another app built from
// the same src/ — test-apps/adapty-devtools-pods sets it — so appId / appName come from that app.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveAppRoot(
  env = process.env.WVD_APP_ROOT,
  defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
) {
  return env ? resolve(env) : defaultRoot;
}

export const APP_ROOT = resolveAppRoot();
