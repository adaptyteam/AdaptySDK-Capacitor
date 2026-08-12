import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBounds } from '../android-device.mjs';
import { resolvePlatformName } from '../platform.mjs';

const BOTH = { hasSimulator: true, hasAndroid: true };
const NEITHER = { hasSimulator: false, hasAndroid: false };

test('an explicit flag wins over what is running', () => {
  assert.equal(resolvePlatformName({ flag: 'android', probes: BOTH }), 'android');
  assert.equal(resolvePlatformName({ flag: 'ios', probes: BOTH }), 'ios');
});

test('WVD_PLATFORM is honoured when no flag is passed', () => {
  assert.equal(resolvePlatformName({ env: 'ANDROID', probes: BOTH }), 'android');
});

test('autodetect picks the only thing running', () => {
  assert.equal(resolvePlatformName({ env: '', probes: { hasSimulator: true, hasAndroid: false } }), 'ios');
  assert.equal(resolvePlatformName({ env: '', probes: { hasSimulator: false, hasAndroid: true } }), 'android');
});

// The failure with no symptom: guessing here would run every command against the wrong
// platform and the output would look entirely normal.
test('an ambiguous environment is an error naming the flag', () => {
  assert.throws(() => resolvePlatformName({ env: '', probes: BOTH }), /pass --ios or --android/);
});

test('an empty environment is an error, not a default', () => {
  assert.throws(() => resolvePlatformName({ env: '', probes: NEITHER }), /no booted iOS simulator/);
});

test('an unknown platform name is rejected', () => {
  assert.throws(() => resolvePlatformName({ flag: 'web', probes: BOTH }), /unknown platform "web"/);
});

const DUMP = [
  '<node text="" resource-id="x" bounds="[0,0][1344,2992]" />',
  '<node text="Not now" resource-id="y" bounds="[72,2770][654,2878]" />',
  '<node text="1-tap buy" resource-id="z" bounds="[72,2770][1272,2878]" />',
  '<node content-desc="Test card, always approves" bounds="[0,1913][1344,2105]" />',
].join('');

test('bounds are the centre of the matched node', () => {
  assert.deepEqual(findBounds(DUMP, '1-tap buy'), { x: 672, y: 2824, bounds: [72, 2770, 1272, 2878] });
});

test('matching is case-insensitive and covers content-desc', () => {
  assert.deepEqual(findBounds(DUMP, 'test card')?.y, 2009);
});

test('a needle that only appears in an attribute name matches nothing', () => {
  // "resource-id" is present in every node; matching node text would return the first
  // rectangle in the tree, which is the whole screen.
  assert.equal(findBounds(DUMP, 'resource-id'), null);
});

test('no match returns null rather than a wrong rectangle', () => {
  assert.equal(findBounds(DUMP, 'Subscribe'), null);
});
