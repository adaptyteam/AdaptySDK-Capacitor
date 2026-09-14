// Chrome DevTools Protocol transport — the Android counterpart of inspector.mjs.
//
// Both transports exist to satisfy one contract: `{ evaluate(expression), close() }`,
// where evaluate takes a single expression and returns a primitive. That is the whole
// platform seam — page-script.mjs, steps.mjs and runner.mjs are shared verbatim.
//
// This is a quarter the size of the iOS side because Android needs no inspector proxy:
// `adb forward` exposes the WebView's devtools socket directly, and the page target is
// listed over plain HTTP.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { forwardDevtools } from './android-device.mjs';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Fixed rather than ephemeral so a leaked forward from a previous run is reused instead of
// accumulating — adb replaces an existing forward on the same local port.
//
// NOT 9222: that is ios_webkit_debug_proxy's port, and this tool now drives both platforms
// on one machine. Sharing it let `adb forward` bind 127.0.0.1:9222 first and shadow the iOS
// proxy, so every iOS command failed with "lists no inspectable page" while the Android side
// looked perfectly healthy — a cross-platform collision with no obvious symptom.
const PORT = 9333;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function listTargets() {
  // Node's fetch has no connect timeout worth relying on here; the socket is local, so a
  // failure is immediate and surfaces as a TypeError we translate below.
  try {
    const res = await fetch(`http://localhost:${PORT}/json/list`);
    return await res.json();
  } catch {
    return null;
  }
}

// Whole-hostname comparison, not endsWith/includes: `evil.localhost` satisfies both of those.
const servedByCapacitor = (url) => {
  try {
    return new URL(url).hostname === 'localhost';
  } catch {
    return false;
  }
};

let appNameCache;

/** capacitor.config.json's appName, which src/index.html repeats as the document <title>. */
function capacitorAppName() {
  if (appNameCache === undefined) {
    try {
      appNameCache = JSON.parse(readFileSync(resolve(APP_ROOT, 'capacitor.config.json'), 'utf8')).appName ?? null;
    } catch {
      appNameCache = null;
    }
  }
  return appNameCache;
}

/**
 * Picks the devtools app's page out of everything the WebView devtools socket lists.
 *
 * Android is the reason this is not just `targets[0]`: a presented onboarding renders in its
 * OWN WebView, so it is listed as a second page — and it sorts first. Driving it looked
 * healthy but read the wrong DOM, and `logs` then blamed the app bundle
 * ("window.__adaptyDevtoolsLogs is not published") for what was really a target mix-up. The
 * target also outlives the onboarding: dismissing it and even `/json/close` leave it listed,
 * so the mix-up lasted until the next relaunch.
 *
 * Two rules, because neither covers the app on its own:
 * - the hostname Capacitor serves from, `localhost`, which nothing the app presents shares;
 * - failing that, the document title, which equals capacitor.config.json's `appName`.
 *
 * The title rule is not a nicety: `yarn dev:android` runs `cap run android --live-reload
 * --host <ip> --port 5173`, so Capacitor sets `server.url` and the app is served from an IP.
 * On the url rule alone that setup found no page and fell back to the first one — the
 * onboarding — reinstating the exact bug this function exists to prevent.
 *
 * Only when neither rule matches does it fall back to the first page, which is what it always
 * used to take.
 */
export function selectAppTarget(targets, { appName } = {}) {
  const pages = (targets ?? []).filter((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  return (
    pages.find((page) => servedByCapacitor(page.url ?? '')) ??
    (appName ? pages.find((page) => page.title === appName) : undefined) ??
    pages[0] ??
    null
  );
}

/**
 * Waits for the app's WebView to be listed. Called after a relaunch for the same reason
 * ensureProxy() is on iOS: the process is up well before the WebView is inspectable, and
 * without the wait the next command reads a page that is about to be replaced.
 */
export async function waitForPage({ timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response from the devtools socket';
  while (Date.now() < deadline) {
    try {
      forwardDevtools(PORT);
    } catch (error) {
      lastError = error.message;
      await sleep(300);
      continue;
    }
    const targets = await listTargets();
    const page = selectAppTarget(targets, { appName: capacitorAppName() });
    if (page) return page;
    lastError = targets ? 'no page target yet' : 'no response from the devtools socket';
    await sleep(300);
  }
  throw new Error(`timed out waiting for the WebView (${lastError})`);
}

/**
 * How long to let a relaunched app settle before waiting on the page. Mirrors the iOS
 * constant so scenario/relaunch read the same on both platforms.
 */
export const RELAUNCH_SETTLE_MS = 3000;

/** No-op on Android — kept so callers do not branch. There is no proxy to start. */
export async function ensureProxy({ settleMs = 0 } = {}) {
  if (settleMs) await sleep(settleMs);
  await waitForPage();
}

export async function openSession() {
  const page = await waitForPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const pending = new Map();
  let nextId = 0;
  let deadReason = null;

  // Closing the socket from inside the transport, rather than trusting each caller's
  // finally block: an open socket with no pending work keeps the Node event loop alive, so
  // wvd would print its error and then hang instead of exiting.
  const failAll = (reason) => {
    deadReason ??= reason;
    for (const [id, slot] of pending) {
      pending.delete(id);
      slot.reject(new Error(reason));
    }
    ws.close();
  };

  await new Promise((ok, fail) => {
    const timer = setTimeout(() => {
      ws.close();
      fail(new Error('timed out opening the CDP websocket'));
    }, 10000);
    ws.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        ok();
      },
      { once: true },
    );
    ws.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        fail(new Error('CDP websocket error'));
      },
      { once: true },
    );
  });

  ws.addEventListener('close', () => failAll('CDP websocket closed'));
  ws.addEventListener('error', () => failAll('CDP websocket error'));

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const slot = pending.get(msg.id);
    if (!slot) return; // an event, not a reply
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(msg.error.message));
    else slot.resolve(msg.result);
  });

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      if (deadReason) {
        reject(new Error(deadReason));
        return;
      }
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return {
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        // Matching the iOS transport: the helpers in page-script.mjs are synchronous, and
        // awaiting here would turn a page that returns a pending promise into a hang.
        awaitPromise: false,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      }
      return result.result?.value;
    },
    close() {
      ws.close();
    },
  };
}
