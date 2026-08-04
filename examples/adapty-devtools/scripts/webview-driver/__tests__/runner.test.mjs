import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSteps } from '../runner.mjs';
import { parseStep } from '../steps.mjs';

/** A session whose evaluate() is driven by a table of expression-substring → result. */
function fakeSession(script) {
  const calls = [];
  return {
    calls,
    evaluate: async (expression) => {
      calls.push(expression);
      for (const [needle, produce] of script) {
        if (expression.includes(needle)) {
          return typeof produce === 'function' ? produce(calls.length) : produce;
        }
      }
      return 'ok';
    },
  };
}

const run = (session, raw) => runSteps(session, raw.map(parseStep), { pollMs: 1, timeoutMs: 50 });

test('runSteps installs the helpers before the first step', async () => {
  const session = fakeSession([]);
  await run(session, ['click:a-b-btn']);
  assert.match(session.calls[0], /window\.__wvd = \{/);
});

test('runSteps reports each step with its result', async () => {
  const session = fakeSession([
    ['__wvd.set', 'calm9'],
    ['__wvd.read', 'Flow name: Calm'],
  ]);
  const { lines, failed } = await run(session, ['set:flow-placement-input=calm9', 'read:flow-name-value']);
  assert.equal(failed, false);
  assert.deepEqual(lines, ['set:flow-placement-input=calm9 -> calm9', 'read:flow-name-value -> Flow name: Calm']);
});

test('runSteps stops at the first failing step', async () => {
  const session = fakeSession([['__wvd.click', { err: 'no #missing-x-btn' }]]);
  const { lines, failed } = await run(session, ['click:missing-x-btn', 'read:a-b-value']);
  assert.equal(failed, true);
  assert.deepEqual(lines, ['click:missing-x-btn -> ERR no #missing-x-btn']);
});

test('runSteps does not treat a value beginning with ERR as a failure', async () => {
  const session = fakeSession([['__wvd.set', 'ERR_case']]);
  const { lines, failed } = await run(session, ['set:a-b-input=ERR_case', 'read:a-b-value']);
  assert.equal(failed, false);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'set:a-b-input=ERR_case -> ERR_case');
});

test('runSteps polls a wait step until it is satisfied', async () => {
  let attempts = 0;
  const session = fakeSession([
    [
      '__wvd.ready',
      () => {
        attempts += 1;
        return attempts < 3 ? false : 'enabled';
      },
    ],
  ]);
  const { lines, failed } = await run(session, ['wait:flow-present-btn:enabled']);
  assert.equal(failed, false);
  assert.equal(attempts, 3);
  assert.equal(lines[0], 'wait:flow-present-btn:enabled -> enabled');
});

test('runSteps fails a wait step that never becomes true', async () => {
  const session = fakeSession([['__wvd.ready', false]]);
  const { lines, failed } = await run(session, ['wait:flow-present-btn:enabled']);
  assert.equal(failed, true);
  assert.match(lines[0], /^wait:flow-present-btn:enabled -> ERR timeout after 50ms/);
});

test('runSteps turns a rejected evaluate into a failing step rather than losing the log', async () => {
  const session = {
    evaluate: async (expression) => {
      if (expression.includes('__wvd.click')) throw new Error('inspector websocket closed');
      return 'ok';
    },
  };
  const { lines, failed } = await run(session, ['read:a-b-value', 'click:a-b-btn', 'read:c-d-value']);
  assert.equal(failed, true);
  assert.equal(lines.length, 2);
  assert.equal(lines[1], 'click:a-b-btn -> ERR inspector websocket closed');
});

test('runSteps renders an inline snapshot on its own lines', async () => {
  const session = fakeSession([
    ['querySelectorAll', JSON.stringify({ route: '#/app', rows: [{ id: 'a-b-btn', text: 'Go' }] })],
  ]);
  const { lines, failed } = await run(session, ['snap']);
  assert.equal(failed, false);
  assert.equal(lines[0], 'snap -> \n#/app | 1 els\n#a-b-btn "Go"');
});
