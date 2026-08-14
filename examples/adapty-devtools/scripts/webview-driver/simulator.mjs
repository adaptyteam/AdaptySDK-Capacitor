// xcrun simctl / sips wrappers. Nothing here is hardcoded to one machine: the UDID
// comes from the booted device list and the bundle id from capacitor.config.json.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// stdio is explicit so a child's stderr is CAPTURED into error.stderr instead of ALSO being
// forwarded to wvd's own stderr, which is what execFileSync does by default. Without this a
// `simctl terminate` against a not-running app printed six NSPOSIXErrorDomain lines, and
// every `wvd shot` printed two simctl notes — noise indistinguishable, to any stderr-based
// check, from the `wvd: …` line main().catch prints for a genuinely fatal error.
const run = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function bootedUdid() {
  const listed = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']));
  const devices = Object.values(listed.devices).flat();
  if (devices.length === 0) throw new Error('no booted simulator');
  if (devices.length > 1) {
    throw new Error(
      `several booted simulators (${devices.map((d) => `${d.name} ${d.udid}`).join(', ')}) — shut down all but one`,
    );
  }
  return devices[0].udid;
}

export function appId() {
  return JSON.parse(readFileSync(resolve(APP_ROOT, 'capacitor.config.json'), 'utf8')).appId;
}

/**
 * Captures the screen and downscales it in place. Native flow/onboarding views and
 * native toasts are invisible to the inspector, so this is the fallback for those.
 *
 * `sips -Z` bounds the LARGER dimension, so on a portrait capture this is the height
 * and the width comes out proportionally smaller (500 gives 230x500 on an iPhone 17
 * Pro). Hence the parameter name — calling it `width` would be a lie.
 */
export function screenshot(outPath, { maxDimension = 500 } = {}) {
  run('xcrun', ['simctl', 'io', bootedUdid(), 'screenshot', '--type=png', outPath]);
  run('sips', ['-Z', String(maxDimension), outPath, '--out', outPath]);
  return outPath;
}

/**
 * Escape hatch when a native view is stuck: costs the SDK session. The simctl pair
 * alone takes ~0.7s; `wvd relaunch` also waits for the new WebView to become
 * inspectable, which dominates the total and varies run to run — measured between
 * ~2.4s and ~4.5s. Time it directly, not through `yarn`, whose Classic wrapper adds
 * ~0.4s of its own and has already produced one wrong figure in this repo.
 */
export function relaunch() {
  const udid = bootedUdid();
  const bundleId = appId();
  try {
    run('xcrun', ['simctl', 'terminate', udid, bundleId]);
  } catch (error) {
    // "found nothing to terminate" is the app simply not running — a healthy cold start,
    // and silent on purpose: warning there made the normal output of the flagship command
    // look fatal. Any OTHER failure is exactly the situation this function exists for — a
    // wedged app — so leave a trace instead of swallowing it and reporting success.
    //
    // The trace is the captured stderr, not error.message: message is only ever
    // "Command failed: xcrun simctl terminate <udid> <bundle>", which carries no cause.
    const stderr = String(error.stderr ?? '').trim();
    if (!/found nothing to terminate/i.test(stderr)) {
      console.error(`wvd: terminate failed — ${stderr || error.message}`);
    }
  }
  // --terminate-running-process is what makes the launch authoritative. A bare `launch`
  // does not restart an already-running app, so without it a swallowed terminate failure
  // would leave the old process in place while `wvd relaunch` still printed a pid and
  // exited 0 — an agent would read that as a successful restart.
  return run('xcrun', ['simctl', 'launch', '--terminate-running-process', udid, bundleId]);
}

/**
 * Reads the native SDK log out of the simulator — the same records the Xcode console
 * shows. --info --debug are not optional: AdaptyLogger maps verbose to .info and debug
 * to .debug, and neither is persisted without them.
 */
export function nativeLog({ seconds = 60 } = {}) {
  return execFileSync(
    'xcrun',
    [
      'simctl',
      'spawn',
      bootedUdid(),
      'log',
      'show',
      '--last',
      `${seconds}s`,
      '--style',
      'compact',
      '--info',
      '--debug',
      '--predicate',
      'subsystem == "io.adapty"',
    ],
    // stderr is piped, not ignored: because stdio is explicit, 'pipe' captures WITHOUT
    // forwarding, so log show's harmless `getpwuid_r did not find a match` warning stays
    // hidden on success while a real failure's cause lands in error.stderr. Ignoring it
    // discarded the cause outright, leaving only "Command failed: xcrun simctl spawn …".
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 32 * 1024 * 1024 },
  );
}
