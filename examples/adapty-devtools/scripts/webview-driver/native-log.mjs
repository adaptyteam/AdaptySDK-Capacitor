// Pure parsing/formatting for `log show --style compact` output from the simulator.

// 2026-08-04 12:31:34.903 I  App[76588:5b44fc] [io.adapty:sdk] GET --> /sdk/...
// The thread id accepts either case: every capture seen so far is lowercase hex, but a
// non-match here drops the whole record silently, so the class is deliberately wider.
const ENTRY = /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2}\.\d{3}) (\S+)\s+\S+?\[\d+:[0-9a-fA-F]+\] \[([^\]]+)\] ?(.*)$/;
// v4.0.2, Adapty/HTTPSession.Log.swift#23 — and the degraded form os_log emits once a
// message exceeds its size limit: "v<decode: missing data>, <decode: missing data>"
const SOURCE = /^v(?:([\d.]+), (.+#\d+)|<decode: missing data>, <decode: missing data>)$/;

// os_log types in compact style, mapped back to the SDK level that produced them.
// Deliberately not the obvious reading: AdaptyLogger sends error->fault and verbose->info,
// so treating "F" as a fault or "I" as info misjudges severity.
const LEVELS = { F: 'error', E: 'warn', Df: 'info', I: 'verbose', Db: 'debug' };

/**
 * The SDK's level vocabulary, ordered most to least severe.
 *
 * Owned here rather than in steps.mjs because this is the only module where the ORDER is
 * load-bearing — filterByLevel ranks by index and `--level` lists these words in its error.
 * `JsLog.logLevel` in src/helpers.ts is the same five words, so `wvd logs` shares it too:
 * when each module kept its own copy the two commands' level columns silently drifted to
 * different widths and `verbose` shifted every column after it.
 */
export const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'];

/**
 * Width of the level column in both `wvd logs` and `wvd native`. Derived from the longest
 * level name, so adding a longer level widens both outputs at once instead of overflowing.
 */
export const LEVEL_COLUMN_WIDTH = Math.max(...LOG_LEVELS.map((level) => level.length));

export function parseNativeLog(raw) {
  const entries = [];
  let current = null;

  for (const line of raw.split('\n')) {
    const head = ENTRY.exec(line);
    if (head) {
      const [, time, type, category, message] = head;
      current = {
        time,
        level: LEVELS[type] ?? type,
        category: category.replace(/^io\.adapty:?/, '') || 'sdk',
        message,
        source: null,
        version: null,
      };
      entries.push(current);
      continue;
    }
    if (!current) continue; // the header row, or noise before the first entry
    const source = SOURCE.exec(line);
    if (source) {
      current.version = source[1] ?? null;
      current.source = source[2] ?? null;
      if (source[2] === undefined) current.truncated = true;
      current = null;
      continue;
    }
    if (line) current.message += ` ${line}`;
  }

  return entries;
}

/**
 * Keeps entries at or above a minimum SDK level.
 *
 * An entry whose level is not in the table — an os_log type letter this code does not
 * know — is KEPT rather than dropped. Dropping it would make `--level` silently hide
 * records that appear without the flag, which is the worst behaviour a diagnostic tool
 * can have; better to show one unrecognised line than to lose it.
 */
export function filterByLevel(entries, minLevel) {
  const limit = LOG_LEVELS.indexOf(minLevel);
  if (limit === -1) throw new Error(`unknown level "${minLevel}" — known: ${LOG_LEVELS.join(', ')}`);
  return entries.filter((entry) => {
    const rank = LOG_LEVELS.indexOf(entry.level);
    return rank === -1 || rank <= limit;
  });
}

/**
 * `subsystem` names the log scope in the header. It defaults to the iOS predicate so the
 * iOS output is unchanged; the Android backend passes its tag filter instead, because a
 * header claiming `io.adapty` over logcat records would be a quiet lie about what was read.
 */
export function formatNativeLog(entries, { window, maxMessage = 200, subsystem = 'io.adapty' } = {}) {
  const lines = entries.map((entry) => {
    const message = entry.message.replace(/\s+/g, ' ').trim();
    const clipped = message.length > maxMessage ? `${message.slice(0, maxMessage)}…` : message;
    const source = entry.source ? ` | ${entry.source}` : '';
    return `${entry.time} ${entry.level.padEnd(LEVEL_COLUMN_WIDTH)} ${clipped}${source}`;
  });
  const scope = window ? ` (${subsystem}, last ${window})` : ` (${subsystem})`;
  const header = `${entries.length} native entries${scope}`;
  // An empty window reads as "the SDK logged nothing", which is almost never true —
  // it usually means the action happened before the window started.
  if (entries.length === 0) return `${header} — nothing in this window; try a longer --seconds`;
  return [header, ...lines].join('\n');
}
