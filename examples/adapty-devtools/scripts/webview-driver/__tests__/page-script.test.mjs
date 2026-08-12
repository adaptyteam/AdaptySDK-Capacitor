import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLLECT_SNAPSHOT, HELPERS_SOURCE, LOG_TAIL } from '../page-script.mjs';

// page-script.mjs is JavaScript inside template literals, so every other safety net misses
// it: ESLint and Prettier do not cover .mjs here, tsc never sees it, and no other test
// executes it — while almost every wvd command depends on it and the document invites edits.
//
// new Function(source) runs the parser WITHOUT running the code, which needs no DOM and no
// simulator. That is the whole point: a typo in these strings otherwise only surfaces as an
// opaque inspector failure against a running app.
const compiles = (source) => new Function(source);

// Runtime.evaluate takes an expression, not a program. `return (<source>)` only compiles if
// each export really is one expression, which is the contract the module header states.
const compilesAsExpression = (source) => new Function(`return (${source});`);

test('HELPERS_SOURCE is syntactically valid and is a single expression', () => {
  assert.doesNotThrow(() => compiles(HELPERS_SOURCE));
  assert.doesNotThrow(() => compilesAsExpression(HELPERS_SOURCE));
});

test('COLLECT_SNAPSHOT is syntactically valid and is a single expression', () => {
  assert.doesNotThrow(() => compiles(COLLECT_SNAPSHOT));
  assert.doesNotThrow(() => compilesAsExpression(COLLECT_SNAPSHOT));
});

test('LOG_TAIL builds syntactically valid source for the counts callers pass', () => {
  // LOG_TAIL is a factory, not a string: it has to be called, and the interpolated count is
  // part of what gets parsed.
  for (const count of [1, 5, 20, 1000]) {
    assert.doesNotThrow(() => compiles(LOG_TAIL(count)), `LOG_TAIL(${count})`);
    assert.doesNotThrow(() => compilesAsExpression(LOG_TAIL(count)), `LOG_TAIL(${count})`);
  }
});

test('LOG_TAIL interpolates the count into the slice rather than dropping it', () => {
  assert.match(LOG_TAIL(5), /slice\(-5\)/);
  assert.match(LOG_TAIL(20), /slice\(-20\)/);
});

test('the helpers expose exactly the operations the runner calls', () => {
  // runner.mjs evaluates __wvd.set/click/read/ready by name, so a rename here would break
  // every step with a message about the page rather than about this file.
  for (const op of ['set:', 'click:', 'read:', 'ready:']) {
    assert.ok(HELPERS_SOURCE.includes(op), `missing __wvd.${op.slice(0, -1)}`);
  }
});
