import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectAppTarget } from '../cdp.mjs';

// capacitor.config.json's appName, which src/index.html repeats as its <title> — so it is what
// CDP reports as the target title.
const APP_NAME = 'Adapty capacitor devtools';
const opts = { appName: APP_NAME };

const appPage = {
  type: 'page',
  title: APP_NAME,
  url: 'https://localhost/#/app',
  webSocketDebuggerUrl: 'ws://localhost:9333/devtools/page/APP',
};

// A presented onboarding renders in its OWN WebView on Android, so it is listed as a second
// CDP page — and it sorts first. Taking targets[0] drove every command against the onboarding
// instead of the app: `snap` returned the onboarding DOM and `logs` reported the app bundle as
// outdated, because `window.__adaptyDevtoolsLogs` only exists on the app page.
const onboardingPage = {
  type: 'page',
  title: 'test_anna',
  url: 'https://14c3d623-2f3a-455a-aa86-ef83dff6913b.octopusbuilder.com/b09744',
  webSocketDebuggerUrl: 'ws://localhost:9333/devtools/page/ONB',
};

test('the app page wins over an onboarding WebView listed before it', () => {
  assert.equal(selectAppTarget([onboardingPage, appPage], opts), appPage);
});

test('the app page is still found when it is listed first', () => {
  assert.equal(selectAppTarget([appPage, onboardingPage], opts), appPage);
});

// The onboarding target survives dismissal — the native view keeps the WebView alive and
// /json/close does not remove it — so this has to hold for the rest of the session, not just
// while the onboarding is on screen.
test('a lingering onboarding target never shadows the app again', () => {
  const stale = { ...onboardingPage, title: 'test_anna (closed)' };
  assert.equal(selectAppTarget([stale, appPage], opts), appPage);
});

test('a target with no debugger url is skipped', () => {
  const notDebuggable = { type: 'page', url: 'https://localhost/#/app' };
  assert.equal(selectAppTarget([notDebuggable, appPage], opts), appPage);
});

test('non-page targets are skipped', () => {
  const worker = { ...appPage, type: 'service_worker' };
  assert.equal(selectAppTarget([worker, appPage], opts), appPage);
});

// `yarn dev:android` runs `cap run android --live-reload --host 192.168.1.76 --port 5173`, so
// Capacitor sets server.url and the app is NOT on localhost. Falling back to the first page here
// put the driver straight back on the onboarding — the exact bug this module exists to avoid.
test('the app is found under live-reload, where it is served from an IP', () => {
  const liveReload = { ...appPage, url: 'http://192.168.1.76:5173/#/app' };
  assert.equal(selectAppTarget([onboardingPage, liveReload], opts), liveReload);
});

test('a live-reload host of 127.0.0.1 is not special-cased away', () => {
  const liveReload = { ...appPage, url: 'http://127.0.0.1:5173/#/app' };
  assert.equal(selectAppTarget([onboardingPage, liveReload], opts), liveReload);
});

// Last resort only: neither rule matched, so this is a setup the driver does not recognise.
// Taking the first page is what it has always done; it must not start throwing instead.
test('the first page is used when neither the url nor the title identifies the app', () => {
  const unknownA = { ...onboardingPage, title: 'something else' };
  const unknownB = { ...onboardingPage, title: 'another thing' };
  assert.equal(selectAppTarget([unknownA, unknownB], opts), unknownA);
});

test('the title is not consulted when no app name is known', () => {
  const liveReload = { ...appPage, url: 'http://192.168.1.76:5173/#/app' };
  assert.equal(selectAppTarget([onboardingPage, liveReload], {}), onboardingPage);
});

test('an http localhost page counts as the app', () => {
  const insecure = { ...appPage, url: 'http://localhost/#/app' };
  assert.equal(selectAppTarget([onboardingPage, insecure], opts), insecure);
});

// `evil.localhost` ends with "localhost" and contains it, so both endsWith and substring
// matching would take it. Only comparing the whole hostname rejects it.
test('a lookalike host is not mistaken for localhost', () => {
  const lookalike = { ...onboardingPage, url: 'https://evil.localhost/x' };
  assert.equal(selectAppTarget([lookalike, appPage], opts), appPage);
});

test('a host merely containing localhost is not mistaken for it', () => {
  const lookalike = { ...onboardingPage, url: 'https://notlocalhost.com/x' };
  assert.equal(selectAppTarget([lookalike, appPage], opts), appPage);
});

test('no page targets means no target', () => {
  assert.equal(selectAppTarget([], opts), null);
  assert.equal(selectAppTarget([{ ...appPage, type: 'service_worker' }], opts), null);
});

test('a malformed url does not throw', () => {
  const broken = { ...onboardingPage, url: 'not a url' };
  assert.equal(selectAppTarget([broken, appPage], opts), appPage);
});
