import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterByLevel, formatNativeLog, parseNativeLog } from '../native-log.mjs';

const RAW = [
  'Timestamp               Ty Process[PID:TID]',
  '2026-08-04 12:31:34.903 I  App[76588:5b44fc] [io.adapty:sdk] GET --> /sdk/company/KEY/app/net-config.json [iFXaMa]',
  '----------REQUEST START----------',
  '$ curl -v -X GET "https://fallback.adapty.io/api/v1/sdk/company/KEY/app/net-config.json"',
  '----------REQUEST END------------',
  'v4.0.2, Adapty/HTTPSession.Log.swift#23',
  '2026-08-04 12:31:34.904 Df App[76588:5b44f3] [io.adapty:sdk] Adapty activated successfully. [MXvG07]',
  'v4.0.2, Adapty/Adapty+Activate.swift#99',
  '2026-08-04 12:31:34.907 F  App[76588:5b4501] [io.adapty:sdk] UpdateASAToken: attribution error Code=3',
  'v4.0.2, Adapty/Adapty+UpdateASAToken.swift#57',
  '2026-08-04 12:31:35.486 I  App[76588:5b44fb] [io.adapty:sdk] 200 <-- GET /sdk/company/KEY/app/net-config.json - 0.574s',
  '----------RESPONSE END--------<…>',
  'v<decode: missing data>, <decode: missing data>',
].join('\n');

test('parseNativeLog reads one entry per os_log record', () => {
  const entries = parseNativeLog(RAW);
  assert.equal(entries.length, 4);
  assert.deepEqual(entries[1], {
    time: '12:31:34.904',
    level: 'info',
    category: 'sdk',
    message: 'Adapty activated successfully. [MXvG07]',
    source: 'Adapty/Adapty+Activate.swift#99',
    version: '4.0.2',
  });
});

test('parseNativeLog maps os_log types back to the SDK level that produced them', () => {
  const entries = parseNativeLog(RAW);
  assert.deepEqual(
    entries.map((entry) => entry.level),
    ['verbose', 'info', 'error', 'verbose'],
  );
});

test('parseNativeLog folds a multi-line message into its entry', () => {
  const [first] = parseNativeLog(RAW);
  assert.match(first.message, /REQUEST START/);
  assert.match(first.message, /curl -v -X GET/);
  assert.equal(first.source, 'Adapty/HTTPSession.Log.swift#23');
});

test('parseNativeLog consumes the placeholder os_log leaves when it truncates', () => {
  const last = parseNativeLog(RAW).at(-1);
  assert.equal(last.truncated, true);
  assert.equal(last.source, null);
  assert.equal(last.version, null);
  assert.doesNotMatch(last.message, /decode: missing data/);
});

test('parseNativeLog ignores the header row and an empty log', () => {
  assert.deepEqual(parseNativeLog('Timestamp               Ty Process[PID:TID]'), []);
  assert.deepEqual(parseNativeLog(''), []);
});

test('filterByLevel keeps entries at or above the minimum', () => {
  const entries = parseNativeLog(RAW);
  assert.deepEqual(
    filterByLevel(entries, 'warn').map((entry) => entry.level),
    ['error'],
  );
  assert.equal(filterByLevel(entries, 'verbose').length, 4);
});

test('filterByLevel rejects an unknown level', () => {
  assert.throws(() => filterByLevel([], 'chatty'), /unknown level "chatty"/);
});

test('filterByLevel keeps an entry whose os_log type letter is unrecognised', () => {
  // A letter outside the LEVELS table must never vanish just because --level was passed:
  // it is visible without the flag, so hiding it with the flag would lose diagnostic data.
  const unknown = { time: '12:00:00.000', level: 'Q', category: 'sdk', message: 'x', source: null };
  assert.deepEqual(filterByLevel([unknown], 'error'), [unknown]);
  assert.deepEqual(filterByLevel([unknown], 'debug'), [unknown]);
});

test('parseNativeLog accepts an upper-case thread id', () => {
  const upper = '2026-08-04 12:31:34.904 Df App[76588:5B44F3] [io.adapty:sdk] Activated [MXvG07]';
  assert.equal(parseNativeLog(upper).length, 1);
});

test('formatNativeLog says why an empty window is probably not an empty log', () => {
  const out = formatNativeLog([], { window: '60s' });
  assert.equal(out, '0 native entries (io.adapty, last 60s) — nothing in this window; try a longer --seconds');
});

test('formatNativeLog renders a header, one line per entry, and clips long messages', () => {
  const out = formatNativeLog(parseNativeLog(RAW), { window: '40s', maxMessage: 40 });
  assert.equal(out.split('\n')[0], '4 native entries (io.adapty, last 40s)');
  assert.equal(
    out.split('\n')[2],
    '12:31:34.904 info    Adapty activated successfully. [MXvG07] | Adapty/Adapty+Activate.swift#99',
  );
  assert.match(out.split('\n')[1], /…$|… \| /);
  assert.equal(out.split('\n').length, 5);
});
