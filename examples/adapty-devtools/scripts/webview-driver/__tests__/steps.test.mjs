import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNativeLog } from '../native-log.mjs';
import { scenarioSteps } from '../scenario.mjs';
import { formatLogs, formatSnapshot, parseStep } from '../steps.mjs';

test('formatSnapshot renders a header with route and element count', () => {
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'a-b-btn', text: 'Go' }] });
  assert.equal(out.split('\n')[0], '#/app | 1 els');
});

test('formatSnapshot renders a header only when there are no rows', () => {
  assert.equal(formatSnapshot({ route: '#/logs', rows: [] }), '#/logs | 0 els');
});

test('formatSnapshot quotes text and marks disabled', () => {
  const out = formatSnapshot({
    route: '#/app',
    rows: [{ id: 'flow-present-btn', text: 'Present Flow', disabled: true }],
  });
  assert.equal(out.split('\n')[1], '#flow-present-btn "Present Flow" DISABLED');
});

test('formatSnapshot renders values with a leading equals sign', () => {
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'flow-placement-input', value: 'calm9' }] });
  assert.equal(out.split('\n')[1], '#flow-placement-input ="calm9"');
});

test('formatSnapshot renders an empty value rather than dropping it', () => {
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'flow-view-locale-input', value: '' }] });
  assert.equal(out.split('\n')[1], '#flow-view-locale-input =""');
});

test('formatSnapshot marks hidden elements and combines flags', () => {
  const out = formatSnapshot({
    route: '#/app',
    rows: [{ id: 'x-y-btn', text: 'v', disabled: true, hidden: true }],
  });
  assert.equal(out.split('\n')[1], '#x-y-btn "v" DISABLED HIDDEN');
});

test('formatSnapshot truncates long text to 48 characters and marks the cut', () => {
  const long = 'x'.repeat(80);
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'a-b-value', text: long }] });
  assert.equal(out.split('\n')[1], `#a-b-value "${'x'.repeat(48)}…"`);
});

test('formatSnapshot leaves text at the limit unmarked', () => {
  // Only a real cut may carry the marker, or the marker stops meaning "incomplete".
  const exact = 'y'.repeat(48);
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'a-b-value', text: exact }] });
  assert.equal(out.split('\n')[1], `#a-b-value "${exact}"`);
});

test('formatSnapshot marks a clipped product id so it cannot be mistaken for the real one', () => {
  // Regression: `flow-product-1-item` read as `monthly.premium.9` — a valid-looking but wrong id.
  const row = { id: 'flow-product-1-item', text: '1 Month PremiumPrice: $9.99ID: monthly.premium.999' };
  const line = formatSnapshot({ route: '#/app', rows: [row] }).split('\n')[1];
  assert.match(line, /…"$/);
  assert.doesNotMatch(line, /monthly\.premium\.999/);
});

test('formatSnapshot keeps a row on one physical line when text contains a newline', () => {
  const out = formatSnapshot({ route: '#/app', rows: [{ id: 'a-b-value', text: 'one\ntwo' }] });
  assert.equal(out.split('\n').length, 2);
  assert.equal(out.split('\n')[1], '#a-b-value "one\\ntwo"');
});

test('formatSnapshot omits text when there is none', () => {
  assert.equal(formatSnapshot({ route: '#/app', rows: [{ id: 'a-b-btn' }] }).split('\n')[1], '#a-b-btn');
});

test('parseStep reads a set step and keeps the whole value', () => {
  assert.deepEqual(parseStep('set:flow-placement-input=calm9'), {
    op: 'set',
    id: 'flow-placement-input',
    value: 'calm9',
  });
});

test('parseStep keeps equals signs and colons inside a set value', () => {
  assert.deepEqual(parseStep('set:flow-custom-tags-textarea={"a":"b=c"}'), {
    op: 'set',
    id: 'flow-custom-tags-textarea',
    value: '{"a":"b=c"}',
  });
});

test('parseStep accepts an empty set value', () => {
  assert.deepEqual(parseStep('set:flow-view-locale-input='), {
    op: 'set',
    id: 'flow-view-locale-input',
    value: '',
  });
});

test('parseStep reads click and read steps', () => {
  assert.deepEqual(parseStep('click:flow-load-btn'), { op: 'click', id: 'flow-load-btn' });
  assert.deepEqual(parseStep('read:flow-name-value'), { op: 'read', id: 'flow-name-value' });
});

test('parseStep defaults wait to presence and reads every condition', () => {
  assert.deepEqual(parseStep('wait:flow-present-btn'), { op: 'wait', id: 'flow-present-btn', want: 'present' });
  assert.deepEqual(parseStep('wait:flow-present-btn:enabled'), {
    op: 'wait',
    id: 'flow-present-btn',
    want: 'enabled',
  });
  assert.deepEqual(parseStep('wait:flow-present-btn:disabled'), {
    op: 'wait',
    id: 'flow-present-btn',
    want: 'disabled',
  });
  assert.deepEqual(parseStep('wait:flow-view-locale-value:absent'), {
    op: 'wait',
    id: 'flow-view-locale-value',
    want: 'absent',
  });
});

test('parseStep keeps an id that itself ends in a condition word', () => {
  assert.deepEqual(parseStep('wait:onboarding-tracking-enabled'), {
    op: 'wait',
    id: 'onboarding-tracking-enabled',
    want: 'present',
  });
});

test('parseStep reads sleep and snap steps', () => {
  assert.deepEqual(parseStep('sleep:250'), { op: 'sleep', ms: 250 });
  assert.deepEqual(parseStep('snap'), { op: 'snap' });
});

test('parseStep rejects an unknown op', () => {
  assert.throws(() => parseStep('poke:flow-load-btn'), /unknown step op "poke"/);
});

test('parseStep rejects a set step without an equals sign', () => {
  assert.throws(() => parseStep('set:flow-placement-input'), /set step needs <id>=<value>/);
});

test('parseStep rejects a non-numeric or empty sleep', () => {
  assert.throws(() => parseStep('sleep:soon'), /sleep step needs milliseconds/);
  assert.throws(() => parseStep('sleep:'), /sleep step needs milliseconds/);
  assert.throws(() => parseStep('sleep:0x10'), /sleep step needs milliseconds/);
});

test('parseStep rejects a step with a missing id', () => {
  assert.throws(() => parseStep('click:'), /click step needs an id/);
});

test('formatLogs renders a header with the shown and total counts', () => {
  const out = formatLogs({
    total: 81,
    logs: [{ time: '09:41:09.277', level: 'info', funcName: 'activate', message: 'Calling method...', isSDK: true }],
  });
  assert.equal(out.split('\n')[0], '1/81 log entries');
});

test('formatLogs renders one line per entry, sdk-marked', () => {
  const out = formatLogs({
    total: 2,
    logs: [
      { time: '09:41:09.277', level: 'info', funcName: 'activate', message: 'Calling method...', isSDK: true },
      { time: '09:41:09.340', level: 'error', funcName: 'getFlow', message: 'Network failed', isSDK: false },
    ],
  });
  assert.deepEqual(out.split('\n').slice(1), [
    '09:41:09.277 info    [sdk] activate: Calling method...',
    '09:41:09.340 error         getFlow: Network failed',
  ]);
});

test('formatLogs collapses newlines so one entry stays one line', () => {
  const out = formatLogs({
    total: 1,
    logs: [{ time: '09:00:00.000', level: 'warn', funcName: 'x', message: 'a\n b', isSDK: false }],
  });
  assert.equal(out.split('\n').length, 2);
  assert.equal(out.split('\n')[1], '09:00:00.000 warn          x: a b');
});

test('formatLogs keeps the columns aligned when the level is the longest one', () => {
  // `verbose` is 7 characters and the SDK's dominant level. Padding the column to 5 let it
  // overflow and shift every following column, which is what shipped and what the document
  // used to describe as a permanent quirk.
  const out = formatLogs({
    total: 2,
    logs: [
      { time: '09:00:00.000', level: 'verbose', funcName: 'f', message: 'a', isSDK: true },
      { time: '09:00:00.001', level: 'info', funcName: 'f', message: 'b', isSDK: true },
    ],
  });
  const [verbose, info] = out.split('\n').slice(1);
  assert.equal(verbose.indexOf('[sdk]'), info.indexOf('[sdk]'));
});

test('wvd logs and wvd native pad the level column to the same width', () => {
  // The two modules used to hard-code the width independently — 5 here, 7 there — which is
  // how they drifted apart. Both now derive it from LOG_LEVELS, and this fails if either
  // one is changed alone.
  const jsLine = formatLogs({
    total: 1,
    logs: [{ time: '09:00:00.000', level: 'verbose', funcName: 'f', message: 'm', isSDK: true }],
  }).split('\n')[1];
  const nativeLine = formatNativeLog([
    { time: '09:00:00.000', level: 'verbose', message: 'MARKER', source: null },
  ]).split('\n')[1];
  assert.equal(jsLine.indexOf('[sdk]'), nativeLine.indexOf('MARKER'));
});

test('formatLogs reports an empty log', () => {
  assert.equal(formatLogs({ total: 0, logs: [] }), '0/0 log entries');
});

test('scenarioSteps produces a parseable flow scenario covering the whole round trip', () => {
  const steps = scenarioSteps('flow', {});
  for (const step of steps) assert.doesNotThrow(() => parseStep(step));
  const joined = steps.join('\n');
  assert.match(joined, /click:sdk-activate-btn/);
  assert.match(joined, /click:flow-load-btn/);
  assert.match(joined, /click:flow-present-btn/);
  assert.match(joined, /click:flow-dismiss-btn/);
  assert.match(joined, /wait:flow-view-locale-value:absent/);
  // The settle after present must be a sleep: no DOM signal marks native presentation.
  assert.match(joined, /sleep:\d+/);
  assert.doesNotMatch(joined, /wait:flow-view-locale-value$/m);
});

test('scenarioSteps injects the placement and locale only when given', () => {
  const withBoth = scenarioSteps('flow', { placement: 'calm9', locale: 'fr' });
  assert.ok(withBoth.includes('set:flow-placement-input=calm9'));
  assert.ok(withBoth.includes('set:flow-view-locale-input=fr'));
  const without = scenarioSteps('flow', {}).join('\n');
  assert.doesNotMatch(without, /set:flow-placement-input/);
  assert.doesNotMatch(without, /set:flow-view-locale-input/);
});

test('scenarioSteps rejects an unknown scenario', () => {
  assert.throws(() => scenarioSteps('nope', {}), /unknown scenario "nope"/);
});
