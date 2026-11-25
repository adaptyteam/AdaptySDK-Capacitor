// Unit tests for the app message helpers; run with `yarn test-app-message`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAppMessageJson,
  sendAppMessageSafe,
  toFlowMessageValue,
} from '../src/screens/app/native-presentation-controllers/appMessage.ts';

type FakeView = Parameters<typeof sendAppMessageSafe>[0] & { calls: unknown[] };

const fakeView = (impl: () => Promise<void>): FakeView => {
  const calls: unknown[] = [];
  return {
    calls,
    sendAppMessage: (payload) => {
      calls.push(payload);
      return impl();
    },
  };
};

describe('parseAppMessageJson', () => {
  it('parses an object', () => {
    assert.deepEqual(parseAppMessageJson('{"a":[1,{"b":null}]}'), { payload: { a: [1, { b: null }] } });
  });

  for (const input of ['', '{bad', '[1,2]', '"s"', 'null', '42']) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      const result = parseAppMessageJson(input);
      assert.ok('error' in result && typeof result.error === 'string');
    });
  }

  for (const input of ['{"a":1e400}', '{"a":{"b":[-1e400]}}']) {
    it(`rejects non-finite ${input}`, () => {
      assert.deepEqual(parseAppMessageJson(input), { error: 'non-finite' });
    });
  }

  it('wide arrays do not overflow', () => {
    const wide = `{"a":[${'0,'.repeat(300000)}1e400]}`;
    assert.deepEqual(parseAppMessageJson(wide), { error: 'non-finite' });
  });

  it('deep nesting does not overflow', () => {
    const deep = `{"a":${'['.repeat(20000)}1e400${']'.repeat(20000)}}`;
    assert.deepEqual(parseAppMessageJson(deep), { error: 'non-finite' });
  });
});

describe('sendAppMessageSafe', () => {
  it('no view -> error, no call', async () => {
    const result = await sendAppMessageSafe(null, {});
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : '', /no flow view/);
  });

  it('native error that already carries its code -> code shown once', async () => {
    const view = fakeView(() =>
      Promise.reject(Object.assign(new Error('#3001 (wrongParam): x'), { adaptyCode: 3001 })),
    );
    assert.deepEqual(await sendAppMessageSafe(view, { a: 1 }), { ok: false, error: '#3001 (wrongParam): x' });
  });

  it('native error without the tag -> code prepended', async () => {
    const view = fakeView(() => Promise.reject(Object.assign(new Error('view not found'), { adaptyCode: 3001 })));
    assert.deepEqual(await sendAppMessageSafe(view, { a: 1 }), { ok: false, error: '#3001 view not found' });
  });

  it('a longer code with the same prefix is not taken for the tag', async () => {
    const view = fakeView(() => Promise.reject(Object.assign(new Error('#30010 other'), { adaptyCode: 3001 })));
    assert.deepEqual(await sendAppMessageSafe(view, {}), { ok: false, error: '#3001 #30010 other' });
  });

  it('resolved call -> ok, payload passed through', async () => {
    const view = fakeView(() => Promise.resolve());
    assert.deepEqual(await sendAppMessageSafe(view, { a: 1 }), { ok: true });
    assert.deepEqual(view.calls, [{ a: 1 }]);
  });
});

describe('toFlowMessageValue', () => {
  it('passes a nested record', () => {
    const args = { s: 'x', n: 1, b: true, z: null, list: [1, 'a', { deep: [null] }], obj: { k: 'v' } };
    assert.deepEqual(toFlowMessageValue(args), args);
  });

  it('passes primitives', () => {
    assert.equal(toFlowMessageValue('s'), 's');
    assert.equal(toFlowMessageValue(null), null);
  });

  it('a function inside -> undefined', () => {
    assert.equal(toFlowMessageValue({ a: { f: () => 1 } }), undefined);
  });

  it('Infinity inside -> undefined', () => {
    assert.equal(toFlowMessageValue({ a: [1, Infinity] }), undefined);
  });

  it('undefined inside -> undefined', () => {
    assert.equal(toFlowMessageValue({ a: undefined }), undefined);
  });
});
