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

import { inspectorPorts, reallocateInspectorPorts, recordProxySocket, spawnLockPort, withPortLock } from './ports.mjs';
import { bootedUdid, inspectorSocket } from './simulator.mjs';

// resolvePlatform() pins a simulator before any command runs, so bootedUdid() returns it without
// probing. Each simulator has its own proxy on its own pair of ports (ports.mjs).
let udidCache = null;
const udid = () => (udidCache ??= bootedUdid());
let portsCache = null;
const loadPorts = async () => (portsCache ??= await inspectorPorts(udid()));
// The registry is the truth: another process may have moved this simulator meanwhile.
const reloadPorts = async () => (portsCache = await inspectorPorts(udid()));
const MOVED = Symbol('moved');
const ports = () => {
  if (!portsCache) throw new Error('inspector ports read before loadPorts()');
  return portsCache;
};
// One explicit address for every request, matching what the ownership check inspects:
// `localhost` may resolve to ::1, where another process can listen on the same port number.
const HOST = '127.0.0.1';
const deviceListUrl = () => `http://${HOST}:${ports().list}/json`;
const pageListUrl = () => `http://${HOST}:${ports().page}/json`;
const EVAL_TIMEOUT_MS = 10000;
// Local requests answer in milliseconds; a hung one must not hold the spawn lock indefinitely.
const HTTP_TIMEOUT_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getJson = async (url) => (await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })).json();

/**
 * The app's inspectable page, plus whether the proxy answered at all.
 *
 * `reachable` separates the two ways `page` comes back null, which want opposite
 * treatment: nothing listening on the page port (no proxy — spawn one now) versus a proxy
 * that answers and lists no matching page (either stale, or healthy and still waiting for a
 * WebView — worth a moment's patience before it is replaced).
 */
async function pageList() {
  let pages;
  try {
    pages = await getJson(pageListUrl());
  } catch {
    // The proxy is not answering (yet). Not an error on its own — ensureProxy() polls
    // through this state — so it must stay a null rather than a throw.
    return { reachable: false, page: null };
  }
  if (!Array.isArray(pages)) return { reachable: true, page: null };

  // Filter on the Capacitor origin: any other inspectable WebView in the simulator
  // (Safari, another Capacitor app) would otherwise win the race.
  const capacitor = pages.filter((p) => p.webSocketDebuggerUrl && String(p.url).startsWith('capacitor://localhost'));
  // The page port is open to any device the proxy sees. Should the simulator's socket drop,
  // a USB iPhone could take it, and its Capacitor page would pass the filter above.
  if (capacitor.length > 0 && !(await pagePortServesSimulator())) return { reachable: true, page: null };

  // The proxy serves one simulator, so two pages mean two Capacitor apps in it (say, the
  // pods twin next to this one). Refuse rather than drive whichever is listed first.
  if (capacitor.length > 1) {
    const listed = capacitor.map((p) => `${p.appId ?? '?'} ${p.url}`).join(', ');
    throw new Error(`several inspectable Capacitor pages in one simulator (${listed}) — uninstall all but one app`);
  }

  return { reachable: true, page: capacitor[0] ?? null };
}

/** Pure: the debugger URL pointed at HOST, the address the ownership check inspected. */
export function onHost(url) {
  const parsed = new URL(url);
  parsed.hostname = HOST;
  return parsed.toString();
}

/** Pure: whether the proxy's device list assigns `pagePort` to the simulator. */
export function servesSimulator(deviceList, pagePort) {
  return (
    Array.isArray(deviceList) &&
    deviceList.some((d) => d.deviceId === 'SIMULATOR' && String(d.url).endsWith(`:${pagePort}`))
  );
}

async function pagePortServesSimulator() {
  try {
    return servesSimulator(await getJson(deviceListUrl()), ports().page);
  } catch {
    return false;
  }
}

async function inspectablePage() {
  return (await pageList()).page;
}

/**
 * Pure: listening port -> the set of pids listening on it, on any address, from `lsof -F pn`
 * output. A set, not one pid: an IPv4 and an IPv6 listener can share a port number, and the
 * ownership check must see both rather than whichever lsof printed last.
 */
export function parseListeners(text) {
  const byPort = new Map();
  let pid = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid) {
      const port = /:(\d+)$/.exec(line);
      if (!port) continue;
      const pids = byPort.get(Number(port[1])) ?? new Set();
      pids.add(pid);
      byPort.set(Number(port[1]), pids);
    }
  }
  return byPort;
}

/** Pure: whether `pid`, and nothing else, listens on each port of the pair — a finished spawn. */
export function holdsBoth(byPort, { list, page }, pid) {
  const only = (port) => byPort.get(port)?.size === 1 && byPort.get(port).has(pid);
  return only(list) && only(page);
}

/**
 * Pure: the one pid holding the pair, or null when it is not exactly one process. The page port
 * may be unbound — a stale proxy of ours whose simulator socket dropped — so this is for
 * recognising a proxy, not for judging a spawn (holdsBoth).
 */
export function soleHolder(byPort, { list, page }) {
  const pids = new Set([...(byPort.get(list) ?? []), ...(byPort.get(page) ?? [])]);
  return pids.size === 1 && byPort.has(list) ? [...pids][0] : null;
}

/** Pure: the inspector socket an ios_webkit_debug_proxy command line serves, or null. */
export function proxySocket(args) {
  // the executable itself, not any command line that merely mentions it
  if (!/^(\S*\/)?ios_webkit_debug_proxy(\s|$)/.test(args)) return null;
  return /(?:^|\s)-s\s+unix:(\S+)/.exec(args)?.[1] ?? null;
}

function listenersOn({ list, page }) {
  try {
    const out = execFileSync('/usr/sbin/lsof', ['-nP', `-iTCP:${list}`, `-iTCP:${page}`, '-sTCP:LISTEN', '-Fpn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseListeners(out);
  } catch {
    return new Map(); // exit 1: nothing listening
  }
}

function processArgs(pid) {
  try {
    return execFileSync('/bin/ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Who holds this simulator's pair: nobody, our own proxy (`pid`), or something foreign — a
 * proxy for another simulator, one left by an older wvd on a colliding pair, or any other
 * process. Only "ours" may be reused or killed.
 *
 * Fast path: the listener's `-s` socket equals the one the registry recorded at spawn. Only on
 * a mismatch (registry lost, proxy from an older wvd) is the simulator's current socket read,
 * which costs a `simctl getenv`.
 */
async function proxyOwnership(p) {
  const held = listenersOn(p);
  if (held.size === 0) return { state: 'none' };
  // Two processes on the pair (on any address), or a page port held without the list port,
  // is not a proxy wvd started.
  const listPid = soleHolder(held, p);
  if (!listPid) return { state: 'foreign' };
  const socket = proxySocket(processArgs(listPid));
  if (!socket) return { state: 'foreign' };
  if (p.socket && socket === p.socket) return { state: 'ours', pid: listPid };
  let current = null;
  try {
    current = inspectorSocket(udid());
  } catch {
    /* simulator gone: nothing can be ours */
  }
  if (socket !== current) return { state: 'foreign' };
  if (await recordProxySocket(udid(), socket, p.list)) portsCache = { ...p, socket };
  return { state: 'ours', pid: listPid };
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

/** Our proxy's ownership; moves to a fresh pair while a foreign process holds the current one. */
async function claimPorts() {
  await loadPorts();
  const avoid = [];
  for (let i = 0; i < 5; i++) {
    const owner = await proxyOwnership(ports());
    if (owner.state !== 'foreign') return owner;
    avoid.push(ports().list);
    portsCache = await reallocateInspectorPorts(udid(), avoid);
  }
  throw new Error(`every inspector port pair tried for ${udid()} is held by another process (${avoid.join(', ')})`);
}

/**
 * Makes sure ios_webkit_debug_proxy is running for this simulator and serving an inspectable
 * page. Safe to call before every command. Returns as soon as a page is inspectable.
 */
export async function ensureProxy({ settleMs = 500 } = {}) {
  const owner = await claimPorts();
  if (owner.state === 'ours') {
    const first = await pageList();
    if (first.page) return 'already-up';

    // A stale proxy pointed at an old launchd_sim socket answers but lists no pages, so it
    // has to be replaced. But an empty list is ALSO what a perfectly healthy proxy shows
    // while the app's WebView is still starting, and killing it there costs a respawn for
    // nothing — so give a page time to appear before judging. Callers that just relaunched
    // pass RELAUNCH_SETTLE_MS. Nothing listening at all needs no patience: skip to the spawn.
    if (first.reachable && settleMs > 0) {
      const settleDeadline = Date.now() + settleMs;
      do {
        await sleep(200);
        if (await inspectablePage()) return 'already-up';
      } while (Date.now() < settleDeadline);
    }
  }

  // One respawn per pair at a time: two parallel calls for one simulator would otherwise kill
  // each other's fresh proxy. The second finds the first's proxy up and reuses it.
  // Should the pair change while waiting (a foreign listener took it), the lock held is the
  // old pair's: let it go and take the new pair's lock instead.
  for (let i = 0; i < 5; i++) {
    const lockedList = ports().list;
    const result = await withPortLock(
      spawnLockPort(lockedList),
      async () => {
        // Re-read under the lock: a pair another process moved this simulator off while we
        // waited must not get a second proxy just because its foreign listener left again.
        await reloadPorts();
        if (ports().list !== lockedList) return MOVED;
        const again = await claimPorts();
        if (ports().list !== lockedList) return MOVED;
        if (again.state === 'ours' && (await inspectablePage())) return 'already-up';
        return respawnProxy(again.state === 'ours' ? again.pid : null);
      },
      { what: `proxy spawn (${udid()})` },
    );
    if (result !== MOVED) return result;
  }
  throw new Error(`the inspector pair for ${udid()} kept moving — rerun`);
}

async function respawnProxy(stalePid) {
  if (stalePid) {
    try {
      process.kill(stalePid);
    } catch {
      /* already gone */
    }
    // the port must actually be free before the new proxy binds it
    for (let i = 0; i < 20 && listenersOn(ports()).size > 0; i++) await sleep(100);
  }

  const { list, page } = ports();
  const socket = inspectorSocket(udid());
  let spawnFailure = null;
  const child = spawn('ios_webkit_debug_proxy', ['-F', '-s', `unix:${socket}`, '-c', `null:${list},:${page}-${page}`], {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  const portHint = `is port ${list} or ${page} taken? \`lsof -nP -iTCP:${list} -iTCP:${page} -sTCP:LISTEN\``;
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-2000);
    // ios_webkit_debug_proxy keeps running after a failed bind, so its exit cannot be the
    // only signal: whatever else answers on the port must not count as this spawn's success.
    if (/Unable to bind (SIMULATOR|"devices list")/.test(stderr)) {
      spawnFailure ??= new Error(`ios_webkit_debug_proxy could not bind its ports — ${portHint}\n${stderr.trim()}`);
    }
  });
  child.on('exit', (code, signal) => {
    spawnFailure ??= new Error(
      `ios_webkit_debug_proxy exited (${signal ?? `code ${code}`}) — ${portHint}${stderr.trim() ? `\n${stderr.trim()}` : ''}`,
    );
  });
  // Without this listener an ENOENT becomes an unhandled 'error' event and the
  // process dies with a stack trace instead of the install hint.
  child.on('error', (error) => {
    spawnFailure =
      error.code === 'ENOENT'
        ? new Error('ios_webkit_debug_proxy not found — run `brew install ios-webkit-debug-proxy`')
        : error;
  });

  let started = false;
  try {
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      if (spawnFailure) throw spawnFailure;
      if (await inspectablePage()) {
        // the page must come from the child, not from anything else that answers there:
        // both ports, on every address, held by the child alone
        if (!holdsBoth(listenersOn({ list, page }), { list, page }, child.pid)) {
          throw new Error(`ports ${list}/${page} are not both held by the proxy just started — ${portHint}`);
        }
        // false: the simulator was moved to another pair meanwhile — this proxy is stale
        if (!(await recordProxySocket(udid(), socket, list))) return MOVED;
        portsCache = { list, page, socket };
        started = true;
        return 'started';
      }
    }

    let devices = 'unreachable';
    try {
      devices = JSON.stringify(await getJson(deviceListUrl()));
    } catch {
      /* leave as unreachable */
    }
    // false: the simulator was moved to another pair meanwhile — this proxy is stale, the new
    // pair may well work. Same as on success: drop it (finally) and let the caller re-read.
    if (!(await recordProxySocket(udid(), socket, list))) return MOVED;
    // The proxy itself is fine: keep it, and its socket on record, for the next call.
    started = true;
    throw new Error(
      `ios_webkit_debug_proxy is up but lists no inspectable page (devices: ${devices}).\n` +
        'Likely causes: the app is not running (start it with `yarn ios`), or it is a Release build ' +
        '(only Debug sets isInspectable on the WKWebView).',
    );
  } finally {
    // Whatever happened, nothing may keep wvd's own process alive; a proxy that failed is killed.
    if (!started && child.exitCode === null) child.kill();
    child.stderr.destroy();
    child.unref();
  }
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

  const ws = new WebSocket(onHost(page.webSocketDebuggerUrl));
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
