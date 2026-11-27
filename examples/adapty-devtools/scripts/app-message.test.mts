// Unit tests for the app message helpers; run with `yarn test-app-message`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appMessageLogParams,
  parseAppMessageJson,
  presentWithMessage,
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

describe('presentWithMessage', () => {
  type LogEntry = [level: string, line: string, params?: Record<string, unknown>];

  // Records calls in order; send settles on a later tick to expose ordering bugs
  const recordingView = (sendError?: Error) => {
    const calls: unknown[][] = [];
    let sendDone = false;
    let presentSawSendDone: boolean | undefined;
    const view = {
      sendAppMessage: async (payload: unknown) => {
        calls.push(['send', payload]);
        await new Promise((resolve) => setTimeout(resolve, 5));
        sendDone = true;
        if (sendError) throw sendError;
      },
      present: async () => {
        presentSawSendDone = sendDone;
        calls.push(['present']);
      },
    } as unknown as Parameters<typeof presentWithMessage>[0]['view'];
    return { view, calls, presentSawSendDone: () => presentSawSendDone };
  };

  const recordingLog = () => {
    const entries: LogEntry[] = [];
    const log: Parameters<typeof presentWithMessage>[0]['log'] = (level, line, params) => {
      entries.push(params === undefined ? [level, line] : [level, line, params]);
    };
    return { entries, log };
  };

  it('valid JSON + sendFirst -> send resolves, then present', async () => {
    const rec = recordingView();
    const logs = recordingLog();
    await presentWithMessage({
      view: rec.view,
      json: '{"action":"noop","title":"A"}',
      sendFirst: true,
      log: logs.log,
    });
    assert.deepEqual(rec.calls, [['send', { action: 'noop', title: 'A' }], ['present']]);
    assert.equal(rec.presentSawSendDone(), true);
    assert.deepEqual(logs.entries, [
      ['info', 'Send app message ok (accepted by native)', { keys: ['action', 'title'] }],
    ]);
  });

  it('native send rejects + sendFirst -> error logged, still presents after send', async () => {
    const rec = recordingView(new Error('view not found'));
    const logs = recordingLog();
    await presentWithMessage({ view: rec.view, json: '{"a":1}', sendFirst: true, log: logs.log });
    assert.deepEqual(rec.calls, [['send', { a: 1 }], ['present']]);
    assert.equal(rec.presentSawSendDone(), true);
    assert.deepEqual(logs.entries, [
      ['error', 'Send app message failed: view not found', { keys: ['a'], error: 'view not found' }],
    ]);
  });

  it('deeply nested payload -> log entries stay serializable', async () => {
    const depth = 20000;
    const json = '{"a":'.repeat(depth) + '1' + '}'.repeat(depth);
    const view = {
      // Mirrors the bridge: serializing such a payload overflows the stack
      sendAppMessage: async (payload: unknown) => {
        JSON.stringify(payload);
      },
      present: async () => {},
    } as unknown as Parameters<typeof presentWithMessage>[0]['view'];
    const logs = recordingLog();
    await presentWithMessage({ view, json, sendFirst: true, log: logs.log });
    assert.equal(logs.entries.length, 1);
    assert.deepEqual(logs.entries[0]?.[2]?.keys, ['a']);
    assert.doesNotThrow(() => JSON.stringify(logs.entries));
  });

  it('wide payload -> logged keys are capped', () => {
    const payload = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]));
    assert.equal(appMessageLogParams(payload).keys.length, 20);
  });

  it('invalid JSON + sendFirst -> warn, no send, still presents', async () => {
    const rec = recordingView();
    const logs = recordingLog();
    await presentWithMessage({ view: rec.view, json: '{', sendFirst: true, log: logs.log });
    assert.deepEqual(rec.calls, [['present']]);
    assert.deepEqual(logs.entries, [['warn', 'Send app message: invalid JSON', { error: 'not valid JSON' }]]);
  });

  it('sendFirst false -> present only', async () => {
    const rec = recordingView();
    const logs = recordingLog();
    await presentWithMessage({
      view: rec.view,
      json: '{"action":"noop"}',
      sendFirst: false,
      log: logs.log,
    });
    assert.deepEqual(rec.calls, [['present']]);
    assert.deepEqual(logs.entries, []);
  });
});
