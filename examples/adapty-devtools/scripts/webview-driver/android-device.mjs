// adb wrappers — the Android counterpart of simulator.mjs. Nothing is hardcoded to one
// machine: the serial comes from the attached device list, the package from build.gradle.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Same explicit stdio as simulator.mjs: 'pipe' CAPTURES a child's stderr into
// error.stderr instead of also forwarding it to wvd's own stderr, where it would be
// indistinguishable from the `wvd: …` line main().catch prints for a fatal error.
const run = (args, options = {}) =>
  execFileSync('adb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();

/**
 * The one attached device. Mirrors bootedUdid()'s contract deliberately: refusing to guess
 * between two devices is what keeps a command from silently driving the wrong one.
 */
export function deviceSerial() {
  const lines = run(['devices'])
    .split('\n')
    .slice(1) // "List of devices attached"
    .map((line) => line.trim())
    .filter(Boolean);
  const ready = lines.filter((line) => /\tdevice$/.test(line)).map((line) => line.split('\t')[0]);
  if (ready.length === 0) {
    const pending = lines.length ? ` (attached but not ready: ${lines.join(', ')})` : '';
    throw new Error(`no attached Android device${pending}`);
  }
  if (ready.length > 1) {
    throw new Error(`several attached devices (${ready.join(', ')}) — leave one, or unset the others`);
  }
  return ready[0];
}

/**
 * The Android package. Read from build.gradle, NOT from capacitor.config.json's appId:
 * `yarn credentials` patches the two independently and they genuinely differ — this repo
 * ships iOS `com.adapty.adaptydemoapp` alongside Android `com.adaptytest`. Taking appId
 * here would target a package that does not exist and every adb call would no-op.
 */
export function packageName() {
  const gradle = readFileSync(resolve(APP_ROOT, 'android/app/build.gradle'), 'utf8');
  const match = /applicationId\s+"([^"]+)"/.exec(gradle);
  if (!match) throw new Error('no applicationId in android/app/build.gradle');
  return match[1];
}

const serialArgs = () => ['-s', deviceSerial()];

/**
 * The app's pid, or null when it is not running.
 *
 * `pidof` exits 1 with no output for a process that is not running, and execFileSync throws
 * on a non-zero exit — so the obvious implementation makes "the app is stopped" fatal. That
 * broke relaunch: force-stop leaves the app legitimately dead for a moment, and the wait for
 * the new pid died on the first poll while the relaunch itself had actually worked.
 */
export function appPid() {
  try {
    return run([...serialArgs(), 'shell', 'pidof', packageName()]) || null;
  } catch {
    return null;
  }
}

/**
 * Forwards a local port to the WebView's devtools socket, whose name carries the app's
 * CURRENT pid — so this has to be re-resolved after every relaunch, not cached.
 */
export function forwardDevtools(port) {
  const pid = appPid();
  if (!pid) throw new Error(`${packageName()} is not running — launch it first`);
  run([...serialArgs(), 'forward', `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`]);
  return pid;
}

/** Screen capture + downscale. See simulator.mjs#screenshot for why maxDimension, not width. */
export function screenshot(outPath, { maxDimension = 500 } = {}) {
  const png = execFileSync('adb', [...serialArgs(), 'exec-out', 'screencap', '-p'], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // exec-out, and written through Node rather than a shell redirect: plain `adb shell
  // screencap` sends the PNG down a pty that rewrites \n as \r\n and corrupts every capture.
  writeFileSync(outPath, png);
  execFileSync('sips', ['-Z', String(maxDimension), outPath, '--out', outPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return outPath;
}

/**
 * force-stop + start. The launcher activity is RESOLVED rather than assumed: Capacitor
 * leaves the activity in whatever package the project was generated under, so here it is
 * `com.adaptytest/com.example.plugin.MainActivity` — a guessed `<pkg>/.MainActivity`
 * would not exist.
 */
export function relaunch() {
  const pkg = packageName();
  const serial = serialArgs();
  run([...serial, 'shell', 'am', 'force-stop', pkg]);
  const component = run([...serial, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', pkg])
    .split('\n')
    .pop()
    .trim();
  if (!component.includes('/')) throw new Error(`could not resolve a launcher activity for ${pkg}`);
  run([...serial, 'shell', 'am', 'start', '-n', component]);
  // Report the same shape as the iOS side — "<package>: <pid>" — so callers and docs do
  // not have to branch on platform to read it.
  const pid = waitForPid();
  return `${pkg}: ${pid ?? 'not running'}`;
}

function waitForPid({ timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = appPid();
    if (pid) return pid;
    sleepSync(150);
  }
  return null;
}

/** Blocking sleep — relaunch() is synchronous, and an unpaced loop spins adb ~200 times. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Wipes app data — the Android answer to "clean install". iOS needs uninstall + install
 * (~1 min); this is a second, which matters for the cases whose precondition is a fresh
 * profile. It also stops the app, so a relaunch has to follow.
 */
export function clearData() {
  const pkg = packageName();
  run([...serialArgs(), 'shell', 'pm', 'clear', pkg]);
  return pkg;
}

/**
 * Raw logcat for a time window. The since-time is computed ON THE DEVICE
 * (`date -d @epoch`) rather than on the host: logcat prints device-local timestamps, so a
 * host-computed bound silently shifts the window by the clock skew between the two.
 */
export function nativeLog({ seconds = 60 } = {}) {
  const serial = serialArgs();
  const since = run([...serial, 'shell', `date -d @$(( $(date +%s) - ${Number(seconds)} )) "+%m-%d %H:%M:%S.000"`]);
  return execFileSync('adb', [...serial, 'logcat', '-d', '-v', 'time', '-t', since], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Centre point of the first node whose text or content-desc contains `needle`.
 *
 * This has no iOS equivalent and is the main reason the Android backend is worth having:
 * uiautomator exposes a real hierarchy with bounds, so a tap on native UI — a Google Play
 * purchase sheet, a system dialog — lands on measured coordinates instead of ones derived
 * from a screenshot.
 *
 * Returns the centre only. The full dump is ~40 KB of XML on a single line; printing it is
 * what this function exists to avoid.
 */
export function uiBounds(needle) {
  const serial = serialArgs();
  run([...serial, 'shell', 'uiautomator', 'dump', '/sdcard/wvd-ui.xml']);
  const xml = run([...serial, 'shell', 'cat', '/sdcard/wvd-ui.xml'], { maxBuffer: 16 * 1024 * 1024 });
  return findBounds(xml, needle);
}

/**
 * Pure half of uiBounds, so it is testable without a device.
 *
 * Matches on text= and content-desc= only. Matching the whole node string would let the
 * needle hit an attribute name or a resource id and return a wildly wrong rectangle.
 */
export function findBounds(xml, needle) {
  const wanted = String(needle).toLowerCase();
  for (const node of xml.split('<')) {
    const attrs = /(?:text|content-desc)="([^"]*)"/g;
    let hit = false;
    for (let m = attrs.exec(node); m; m = attrs.exec(node)) {
      if (m[1] && m[1].toLowerCase().includes(wanted)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if (!bounds) continue;
    const [x1, y1, x2, y2] = bounds.slice(1).map(Number);
    return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2), bounds: [x1, y1, x2, y2] };
  }
  return null;
}

/** Injects a tap at device pixels — the coordinates uiBounds returns. */
export function tap(x, y) {
  run([...serialArgs(), 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))]);
  return `tapped ${Math.round(x)} ${Math.round(y)}`;
}
