import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAndroidLog } from '../android-log.mjs';
import { filterByLevel, formatNativeLog } from '../native-log.mjs';

// Captured from `adb logcat -v time` on a Pixel emulator running the devtools app.
const RAW = [
  '08-12 15:31:22.441 V/Adapty_v4.0.1(21846): VERBOSE: GET https://api.adaptytech.com/api/v1/sdk/analytics/profiles/X/',
  '08-12 15:31:22.774 I/Adapty_v4.0.1(21846): INFO: CF-Cache-Status: DYNAMIC',
  '08-12 15:31:22.775 E/Adapty_v4.0.1(21846): ERROR: Request failed',
  '08-12 15:31:22.776 D/WindowManager(13457): noise that must not survive the tag filter',
  '08-12 15:31:22.900 V/Adapty_v4.0.1(21846): VERBOSE: Request is successful.',
  '    continued on the next physical line',
].join('\n');

test('keeps only Adapty-tagged records', () => {
  const entries = parseAndroidLog(RAW);
  assert.equal(entries.length, 4);
  assert.ok(!entries.some((entry) => entry.message.includes('noise')));
});

test('reports the level the SDK printed, not the logcat priority', () => {
  const [verbose, info, error] = parseAndroidLog(RAW);
  assert.equal(verbose.level, 'verbose');
  assert.equal(info.level, 'info');
  assert.equal(error.level, 'error');
  // The SDK's own prefix is stripped from the message — it is carried in `level` instead.
  assert.equal(info.message, 'CF-Cache-Status: DYNAMIC');
});

test('captures the native SDK version out of the tag', () => {
  assert.equal(parseAndroidLog(RAW)[0].version, '4.0.1');
});

test('folds continuation lines into the preceding record', () => {
  const last = parseAndroidLog(RAW).at(-1);
  assert.equal(last.message, 'Request is successful. continued on the next physical line');
});

test('entries feed the shared filter and formatter', () => {
  const entries = filterByLevel(parseAndroidLog(RAW), 'info');
  assert.deepEqual(
    entries.map((entry) => entry.level),
    ['info', 'error'],
  );
  const out = formatNativeLog(entries, { window: '60s', subsystem: 'tag Adapty*' });
  assert.match(out, /^2 native entries \(tag Adapty\*, last 60s\)/);
});

test('an empty window says so instead of reading as silence', () => {
  assert.match(formatNativeLog([], { window: '5s', subsystem: 'tag Adapty*' }), /nothing in this window/);
});
