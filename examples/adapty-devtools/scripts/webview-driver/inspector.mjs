// WebKit Inspector Protocol transport for the devtools app's WKWebView in the iOS
// Simulator, proxied by ios_webkit_debug_proxy.
//
// Protocol facts this encodes (all verified against iOS 26.5):
//  - top-level Runtime.* commands are rejected ("'Runtime' domain was not found"),
//    so everything is wrapped in Target.sendMessageToTarget
//  - Runtime.evaluate ignores awaitPromise: a Promise expression resolves to {}.
//    Callers must poll instead of awaiting.
//  - two targetCreated events arrive (type "frame" then type "page"); evaluate works
//    through either, and this code takes whichever arrives first
import { spawn, execFileSync } from 'node:child_process';

const DEVICE_LIST = 'http://localhost:9221/json';
const PAGE_LIST = 'http://localhost:9222/json';
const EVAL_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The app's inspectable page, plus whether the proxy answered at all.
 *
 * `reachable` separates the two ways `page` comes back null, which want opposite
 * treatment: nothing listening on 9222 (no proxy — spawn one now) versus a proxy that
 * answers and lists no matching page (either stale, or healthy and still waiting for a
 * WebView — worth a moment's patience before it is replaced).
 */
async function pageList() {
  let pages;
  try {
    pages = await (await fetch(PAGE_LIST)).json();
  } catch {
    // The proxy is not answering (yet). Not an error on its own — ensureProxy() polls
    // through this state — so it must stay a null rather than a throw.
    return { reachable: false, page: null };
  }
  if (!Array.isArray(pages)) return { reachable: true, page: null };

  // Filter on the Capacitor origin: any other inspectable WebView in the simulator
  // (Safari, another Capacitor app) would otherwise win the race.
  const capacitor = pages.filter((p) => p.webSocketDebuggerUrl && String(p.url).startsWith('capacitor://localhost'));

  // This path never resolves a UDID — it drives whatever the proxy happens to list first.
  // With two booted simulators both running the app that is a coin flip per command, so a
  // click could land on one device while the next screenshot came from the other. Refuse
  // instead of guessing. Checked here rather than via bootedUdid() on purpose: a
  // `simctl list devices booted` costs 0.25-0.65s, several times an entire `wvd snap`.
  if (capacitor.length > 1) {
    const listed = capacitor.map((p) => `${p.appId ?? '?'} ${p.url}`).join(', ');
    throw new Error(
      `several inspectable Capacitor pages (${listed}) — wvd cannot tell which simulator you mean; ` +
        'shut down all but one (`xcrun simctl list devices booted`, then `xcrun simctl shutdown <udid>`)',
    );
  }

  return { reachable: true, page: capacitor[0] ?? null };
}

async function inspectablePage() {
  return (await pageList()).page;
}

function webinspectorSocket() {
  // The path changes whenever the simulator's launchd_sim restarts, so it is looked
  // up every time rather than cached. `head` exits 0 on empty input, so an empty
  // result — not a non-zero exit — is what signals "not found".
  const lookup =
    "lsof -U 2>/dev/null | grep -o '/private/var/tmp/com.apple.launchd.[^ ]*/com.apple.webinspectord_sim.socket' | head -1";
  const out = execFileSync('/bin/sh', ['-c', lookup]).toString().trim();
  if (!out) throw new Error('no com.apple.webinspectord_sim.socket found — is a simulator booted?');
  return out;
}

/**
 * Polls until the app's WebView is inspectable, assuming a working proxy.
 *
 * No `wvd` command calls this: every one of them goes through ensureProxy(), which does
 * the same polling AND starts or replaces the proxy first. Using this directly after a
 * relaunch was a bug — on a machine with no proxy, or a stale one, it polled a dead port
 * for the full timeout and blamed the page. Kept as the underlying primitive, and as the
 * thing ensureProxy() degenerates to once the proxy is known to be healthy.
 */
export async function waitForPage(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await inspectablePage()) return;
    if (Date.now() >= deadline) throw new Error(`no inspectable page after ${timeoutMs}ms`);
    await sleep(200);
  }
}

/**
 * How long ensureProxy() should wait for a page before it concludes the proxy is stale,
 * when the caller has just relaunched the app and knows one is on its way.
 *
 * The default 500ms is nowhere near the ~1.7-3.8s a fresh WebView takes to become
 * inspectable, so a relaunch would otherwise kill a perfectly healthy proxy every time and
 * pay a full respawn — measured at 10.5s for a `wvd relaunch` that takes 2.4-4.5s with the
 * proxy reused.
 */
export const RELAUNCH_SETTLE_MS = 8000;

/**
 * Makes sure ios_webkit_debug_proxy is running and serving an inspectable page.
 * Safe to call before every command. Returns as soon as a page is inspectable.
 */
export async function ensureProxy({ settleMs = 500 } = {}) {
  const first = await pageList();
  if (first.page) return 'already-up';

  // A stale proxy pointed at an old launchd_sim socket answers on 9221 but lists no
  // pages, so it has to be replaced. But an empty list is ALSO what a perfectly healthy
  // proxy shows while the app's WebView is still starting, and killing it there costs a
  // respawn for nothing — so give a page time to appear before judging. Callers that just
  // relaunched pass RELAUNCH_SETTLE_MS. Nothing listening at all needs no patience: skip
  // straight to the spawn.
  if (first.reachable && settleMs > 0) {
    const settleDeadline = Date.now() + settleMs;
    do {
      await sleep(200);
      if (await inspectablePage()) return 'already-up';
    } while (Date.now() < settleDeadline);
  }

  // Synchronous so the port is actually free before the respawn. Exit status 1
  // (nothing matched) is the normal case, hence the empty catch.
  try {
    execFileSync('/usr/bin/pkill', ['-f', 'ios_webkit_debug_proxy'], { stdio: 'ignore' });
  } catch {
    /* nothing to kill */
  }
  await sleep(300);

  const socket = webinspectorSocket();
  let spawnFailure = null;
  const child = spawn('ios_webkit_debug_proxy', ['-F', '-s', `unix:${socket}`], {
    detached: true,
    stdio: 'ignore',
  });
  // Without this listener an ENOENT becomes an unhandled 'error' event and the
  // process dies with a stack trace instead of the install hint.
  child.on('error', (error) => {
    spawnFailure =
      error.code === 'ENOENT'
        ? new Error('ios_webkit_debug_proxy not found — run `brew install ios-webkit-debug-proxy`')
        : error;
  });
  child.unref();

  for (let i = 0; i < 30; i++) {
    await sleep(200);
    if (spawnFailure) throw spawnFailure;
    if (await inspectablePage()) return 'started';
  }

  let devices = 'unreachable';
  try {
    devices = JSON.stringify(await (await fetch(DEVICE_LIST)).json());
  } catch {
    /* leave as unreachable */
  }
  throw new Error(
    `ios_webkit_debug_proxy is up but lists no inspectable page (devices: ${devices}).\n` +
      'Likely causes: the app is not running (start it with `yarn ios`), or it is a Release build ' +
      '(only Debug sets isInspectable on the WKWebView).',
  );
}

/**
 * Opens one inspector session. Inner request ids are routed back to their promises,
 * so several evaluate() calls may be in flight at once.
 *
 * Every path that can strand a caller settles it: outer protocol errors, socket
 * close, target destruction, and a per-call timeout. A silently hanging evaluate
 * would make `wvd` exit with no output, which an agent reads as success.
 */
export async function openSession() {
  await ensureProxy();
  const page = await inspectablePage();
  if (!page) throw new Error('no inspectable page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let targetId = null;
  let outerId = 100;
  let innerId = 0;
  let deadReason = null;

  // Closing the socket here, rather than trusting each caller's finally block, is what
  // keeps the guarantee inside the transport: an open socket with no pending work keeps
  // the Node event loop alive, so `wvd` would print its error and then never exit.
  const failAll = (reason) => {
    deadReason ??= reason;
    for (const [id, slot] of pending) {
      pending.delete(id);
      clearTimeout(slot.timer);
      slot.reject(new Error(reason));
    }
    ws.close();
  };

  await new Promise((resolve, reject) => {
    let settled = false;
    const handshakeTimer = setTimeout(() => {
      settled = true;
      // Without this close the socket outlives the rejection and nothing can shut it
      // down — openSession() never returned a handle — so the process hangs after
      // printing the error. Verified: a peer that completes the upgrade and then stays
      // silent leaves node running until it is killed.
      ws.close();
      reject(new Error('timed out waiting for Target.targetCreated'));
    }, 10000);

    const finishHandshake = () => {
      clearTimeout(handshakeTimer);
      settled = true;
      resolve();
    };

    ws.addEventListener('error', () => {
      clearTimeout(handshakeTimer);
      failAll('inspector websocket error');
      if (!settled) reject(new Error('inspector websocket error'));
    });

    ws.addEventListener('close', () => {
      clearTimeout(handshakeTimer);
      failAll('inspector websocket closed');
      if (!settled) reject(new Error('inspector websocket closed before handshake'));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);

      if (msg.method === 'Target.targetCreated' && !targetId) {
        targetId = msg.params.targetInfo.targetId;
        finishHandshake();
        return;
      }

      if (msg.method === 'Target.targetDestroyed') {
        failAll('inspector target destroyed (page reloaded or app closed)');
        return;
      }

      // An outer-level reply carries an id and no method — e.g. a dead targetId
      // answers with {"error":{"code":-32000,...},"id":533}. Dropping these is what
      // makes an evaluate hang forever.
      if (msg.method === undefined && msg.error) {
        failAll(`inspector protocol error: ${JSON.stringify(msg.error)}`);
        return;
      }

      if (msg.method !== 'Target.dispatchMessageFromTarget') return;
      const inner = JSON.parse(msg.params.message);
      const slot = pending.get(inner.id);
      if (!slot) return;
      pending.delete(inner.id);
      clearTimeout(slot.timer);
      if (inner.error) return slot.reject(new Error(JSON.stringify(inner.error)));
      const result = inner.result?.result;
      if (inner.result?.wasThrown) return slot.reject(new Error(result?.description ?? 'expression threw'));
      slot.resolve(result?.value !== undefined ? result.value : (result?.description ?? null));
    });
  });

  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      if (deadReason) return reject(new Error(deadReason));
      const id = ++innerId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`evaluate timed out after ${EVAL_TIMEOUT_MS}ms`));
      }, EVAL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      ws.send(
        JSON.stringify({
          id: outerId++,
          method: 'Target.sendMessageToTarget',
          params: {
            targetId,
            message: JSON.stringify({
              id,
              method: 'Runtime.evaluate',
              params: { expression, returnByValue: true },
            }),
          },
        }),
      );
    });

  return { evaluate, close: () => ws.close() };
}
