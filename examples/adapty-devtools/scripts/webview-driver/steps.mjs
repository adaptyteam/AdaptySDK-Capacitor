// Pure helpers for the wvd CLI: everything here is testable without a simulator.
import { LEVEL_COLUMN_WIDTH } from './native-log.mjs';

const MAX_TEXT = 48;

/**
 * Renders a page snapshot as compact text for an agent to read.
 * Deliberately terse: this replaces a screenshot, and every byte is context.
 */
export function formatSnapshot({ route, rows }) {
  const lines = rows.map((row) => {
    const parts = [`#${row.id}`];
    if (row.value !== undefined) {
      parts.push(`=${JSON.stringify(row.value)}`);
    } else if (row.text) {
      // The ellipsis is load-bearing: without it a clipped readout is indistinguishable from a
      // complete one, and an agent reads `monthly.premium.9` as a product id when the real value
      // is `monthly.premium.999`. Seeing the marker is the cue to use `read:` or `eval` instead.
      const clipped = row.text.length > MAX_TEXT ? `${row.text.slice(0, MAX_TEXT)}…` : row.text;
      parts.push(JSON.stringify(clipped));
    }
    if (row.disabled) parts.push('DISABLED');
    if (row.hidden) parts.push('HIDDEN');
    return parts.join(' ');
  });
  return [`${route} | ${rows.length} els`, ...lines].join('\n');
}

const WAIT_CONDITIONS = ['enabled', 'disabled', 'absent', 'present'];

/**
 * Parses one CLI step. Grammar:
 *
 *   set:<id>=<value>       set a value through React's native setter
 *   click:<id>             click, refusing a disabled element
 *   read:<id>              read a value or the trimmed text content
 *   wait:<id>              poll until the element exists
 *   wait:<id>:enabled      ...exists and is not disabled
 *   wait:<id>:disabled     ...exists and is disabled
 *   wait:<id>:absent       ...is gone from the DOM
 *   sleep:<ms>             unconditional pause
 *   snap                   inline snapshot at this point in the chain
 */
export function parseStep(raw) {
  if (raw === 'snap') return { op: 'snap' };

  const colon = raw.indexOf(':');
  if (colon === -1) throw new Error(`unknown step op "${raw}"`);
  const op = raw.slice(0, colon);
  const rest = raw.slice(colon + 1);

  if (op === 'sleep') {
    if (!/^\d+$/.test(rest)) throw new Error(`sleep step needs milliseconds, got "${rest}"`);
    return { op: 'sleep', ms: Number(rest) };
  }

  if (op === 'set') {
    const equals = rest.indexOf('=');
    if (equals === -1) throw new Error(`set step needs <id>=<value>, got "${rest}"`);
    const id = rest.slice(0, equals);
    if (!id) throw new Error('set step needs an id');
    return { op: 'set', id, value: rest.slice(equals + 1) };
  }

  if (op === 'wait') {
    // Split on the last colon only: ids never contain one, so an id that merely
    // ends in "-enabled" is untouched.
    const lastColon = rest.lastIndexOf(':');
    const suffix = lastColon === -1 ? null : rest.slice(lastColon + 1);
    const matched = suffix !== null && WAIT_CONDITIONS.includes(suffix);
    const id = matched ? rest.slice(0, lastColon) : rest;
    if (!id) throw new Error('wait step needs an id');
    return { op: 'wait', id, want: matched ? suffix : 'present' };
  }

  if (op === 'click' || op === 'read') {
    if (!rest) throw new Error(`${op} step needs an id`);
    return { op, id: rest };
  }

  throw new Error(`unknown step op "${op}"`);
}

/** Renders a log tail: one entry per line, newest last. */
export function formatLogs({ total, logs }) {
  const lines = logs.map((entry) => {
    // Shared with `wvd native` so the two commands' columns line up. Padding to 5 here let
    // `verbose` — the SDK's dominant level, 7 characters — overflow and shift every
    // column after it on exactly the lines you read most.
    const level = entry.level.padEnd(LEVEL_COLUMN_WIDTH);
    const sdk = entry.isSDK ? '[sdk]' : '     ';
    const message = String(entry.message).replace(/\s+/g, ' ').trim();
    return `${entry.time} ${level} ${sdk} ${entry.funcName}: ${message}`;
  });
  return [`${logs.length}/${total} log entries`, ...lines].join('\n');
}
