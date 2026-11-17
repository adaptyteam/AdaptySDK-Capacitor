// Inspector proxy ports per simulator, so several simulators can be driven side by side.
//
// Each simulator gets its own pair from a host-wide registry, allocated under a lock, so two
// simulators never share a pair — a hash alone could collide, and then one agent's proxy would
// serve, or kill, another's. The registry also remembers which inspector socket the proxy on a
// pair was spawned for, so inspector.mjs can tell its own proxy from a foreign listener.
// Android needs none of this: each session asks adb for a free port (cdp.mjs).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SLOTS = 300;
const INSPECTOR_BASE = 9400; // 9400–9999, two ports per slot
const SPAWN_LOCK_BASE = 12000; // 12000–12299, one per slot
const REGISTRY_LOCK_PORT = 11999;

// Per user, not per app root: the pods twin (WVD_APP_ROOT) drives the same simulators.
const STATE_DIR = join(tmpdir(), 'adapty-wvd');
export const REGISTRY = join(STATE_DIR, 'inspector-ports.json');

/** Pure: FNV-1a over the id, folded into a slot. Case-insensitive, like UDID matching. */
export function deviceSlot(id) {
  let hash = 0x811c9dc5;
  for (const char of id.toUpperCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SLOTS;
}

const slotPorts = (slot) => ({ list: INSPECTOR_BASE + slot * 2, page: INSPECTOR_BASE + slot * 2 + 1 });

/**
 * Pure: the registry with `udid` assigned a pair. Keeps an existing assignment unless its list
 * port is in `avoid`; otherwise starts at the id's hash slot and probes forward past pairs
 * another simulator holds or `avoid` names (ports a foreign process was found listening on).
 */
export function allocateInspectorPorts(registry, udid, { avoid = [] } = {}) {
  const key = udid.toUpperCase();
  const current = registry[key];
  if (current && !avoid.includes(current.list)) return { registry, ports: current };
  const taken = new Set([
    ...Object.entries(registry)
      .filter(([id]) => id !== key)
      .map(([, p]) => p.list),
    ...avoid,
  ]);
  const start = deviceSlot(key);
  for (let i = 0; i < SLOTS; i++) {
    const ports = slotPorts((start + i) % SLOTS);
    if (!taken.has(ports.list)) return { registry: { ...registry, [key]: ports }, ports };
  }
  throw new Error(`no free inspector port pair left in ${REGISTRY} — delete it to start over`);
}

const isPair = (p) =>
  p &&
  Number.isInteger(p.list) &&
  p.list >= INSPECTOR_BASE &&
  p.list < INSPECTOR_BASE + SLOTS * 2 &&
  (p.list - INSPECTOR_BASE) % 2 === 0 &&
  p.page === p.list + 1 &&
  (p.socket === undefined || typeof p.socket === 'string');

/**
 * Pure: a missing registry is empty; an unreadable, corrupt or inconsistent one (a pair out of
 * range, misaligned, or held by two simulators) is an error, not empty — reading it as empty
 * would hand out pairs already in use.
 */
export function parseRegistry(text) {
  const broken = (why) => new Error(`${REGISTRY} ${why} — delete it to start over`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw broken(`is corrupt (${error.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw broken('is not a port registry');
  const seen = new Set();
  for (const [id, pair] of Object.entries(parsed)) {
    if (!isPair(pair)) throw broken(`has an invalid pair for ${id}`);
    if (seen.has(pair.list)) throw broken(`assigns port ${pair.list} twice`);
    seen.add(pair.list);
  }
  return parsed;
}

function readRegistry() {
  let text;
  try {
    text = readFileSync(REGISTRY, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`cannot read ${REGISTRY}: ${error.message}`);
  }
  return parseRegistry(text);
}

/**
 * Read-modify-write of the registry under the registry lock — a port lock like the spawn lock,
 * so a crashed holder releases it with its process and a live one is never broken into.
 */
async function updateRegistry(change) {
  return withPortLock(
    REGISTRY_LOCK_PORT,
    async () => {
      const { registry, result } = change(readRegistry());
      mkdirSync(STATE_DIR, { recursive: true });
      const tmp = `${REGISTRY}.${process.pid}`;
      writeFileSync(tmp, JSON.stringify(registry, null, 2));
      renameSync(tmp, REGISTRY);
      return result;
    },
    { what: 'port registry' },
  );
}

/** The proxy's ports for a simulator, plus the socket its proxy was last spawned for. */
export async function inspectorPorts(udid) {
  const known = readRegistry()[udid.toUpperCase()];
  if (known) return known;
  return updateRegistry((registry) => {
    const { registry: next, ports } = allocateInspectorPorts(registry, udid);
    return { registry: next, result: ports };
  });
}

/** A new pair for `udid`, away from `avoid` — its old pair is held by something else. */
export function reallocateInspectorPorts(udid, avoid) {
  return updateRegistry((registry) => {
    const { registry: next, ports } = allocateInspectorPorts(registry, udid, { avoid });
    return { registry: next, result: ports };
  });
}

/**
 * Records which inspector socket the proxy on `udid`'s pair serves — only while the pair is
 * still the one the proxy was started on, never onto a pair `udid` has moved to since.
 */
export function recordProxySocket(udid, socket, listPort) {
  return updateRegistry((registry) => {
    const key = udid.toUpperCase();
    if (registry[key]?.list !== listPort) return { registry, result: false };
    return { registry: { ...registry, [key]: { ...registry[key], socket } }, result: true };
  });
}

/** The localhost port whose listener is the spawn lock for a pair. */
export const spawnLockPort = (listPort) => SPAWN_LOCK_BASE + (listPort - INSPECTOR_BASE) / 2;

/**
 * Runs `fn` holding a lock that is a listening TCP socket on `port`. The OS closes it when
 * the holder dies, so a crashed or killed wvd can never leave it held, and a slow holder is
 * never broken into by a timeout the way a lock file would be.
 */
export async function withPortLock(port, fn, { timeoutMs = 30000, what = 'wvd' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let server;
  for (;;) {
    // The lock is the listening socket alone: anything that connects to it (a port scan, a
    // stray probe) is dropped at once, or server.close() below would wait for it.
    server = createServer((socket) => socket.destroy());
    const bound = await new Promise((resolve) => {
      server.once('error', (error) => resolve(error.code === 'EADDRINUSE' ? false : error));
      server.listen(port, '127.0.0.1', () => resolve(true));
    });
    if (bound === true) break;
    if (bound !== false) throw bound;
    if (Date.now() > deadline) {
      throw new Error(
        `timed out waiting for the ${what} lock (127.0.0.1:${port}) — held by another wvd, or the port is ` +
          `taken by something else: \`lsof -nP -iTCP:${port}\``,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  try {
    return await fn();
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}
