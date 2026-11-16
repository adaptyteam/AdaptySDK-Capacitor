import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { resolveAppRoot } from '../app-root.mjs';

test('defaults to the example app when WVD_APP_ROOT is unset', () => {
  assert.equal(resolveAppRoot(undefined, '/repo/examples/adapty-devtools'), '/repo/examples/adapty-devtools');
  assert.equal(resolveAppRoot('', '/repo/examples/adapty-devtools'), '/repo/examples/adapty-devtools');
});

test('WVD_APP_ROOT points wvd at another app, relative to the working directory', () => {
  assert.equal(resolveAppRoot('/repo/test-apps/adapty-devtools-pods', '/x'), '/repo/test-apps/adapty-devtools-pods');
  assert.equal(resolveAppRoot('.', '/x'), resolve('.'));
});
