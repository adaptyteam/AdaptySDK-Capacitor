#!/usr/bin/env node
// wvd — drives the devtools app by element id, on the iOS Simulator or an Android device.
// Run from examples/adapty-devtools. See the drive-devtools-webview skill in .claude/skills/.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { filterByLevel, formatNativeLog } from './webview-driver/native-log.mjs';
import { COLLECT_SNAPSHOT, LOG_TAIL } from './webview-driver/page-script.mjs';
import { resolvePlatform } from './webview-driver/platform.mjs';
import { runSteps } from './webview-driver/runner.mjs';
import { SCENARIO_NAMES, scenarioSteps } from './webview-driver/scenario.mjs';
import { formatLogs, formatSnapshot, parseStep } from './webview-driver/steps.mjs';

const USAGE = `usage: yarn wvd [--ios|--android] <command>

  platform is autodetected from what is running; the flag (or WVD_PLATFORM) is required
  only when both a booted simulator and an attached Android device are present

  snap                 print a compact text snapshot of every element with an id
  logs [n]             print the last n log entries (default 20)
  native [--seconds=N]  print the native SDK log (iOS: os_log io.adapty, Android: logcat)
                        options: --level=error|warn|info|verbose|debug --full
  do <step>...         run steps in one session; stops at the first failure
                       set:<id>=<value> | click:<id> | read:<id> | sleep:<ms> | snap
                       wait:<id>[:enabled|:disabled|:absent]
                       option: --timeout=<ms> (default 15000) for wait steps
  shot [path]          screenshot the device, downscaled (default .wvd/shot.png)
  relaunch             terminate and relaunch the app — clears a stuck native view
  scenario flow        activate -> load flow -> present -> dismiss
                       relaunches the app first for a clean session
                       options: --placement=<id> --locale=<code> --no-relaunch
  eval <expression>    evaluate JavaScript in the app's WebView

  android only:
  bounds <text>        centre coordinates of the native view whose text/label matches —
                       use for taps on system UI (Google Play sheets, dialogs)
  tap <x> <y>          inject a tap at device pixels
  clear                wipe app data (pm clear) — the cheap "clean install"
`;

const argv = process.argv.slice(2);
// Stripped before the command is read so every subcommand's own flag parsing is untouched.
const platformFlag = argv.includes('--android') ? 'android' : argv.includes('--ios') ? 'ios' : null;
const [command, ...rest] = argv.filter((token) => token !== '--android' && token !== '--ios');

const render = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

/** Fails with the platform named, so "unknown command" never masks "wrong platform". */
function androidOnly(platform, name) {
  const fn = platform.only[name];
  if (!fn) throw new Error(`${command} is Android-only — current platform is ${platform.name}`);
  return fn;
}

async function main() {
  if (!command) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const platform = await resolvePlatform({ flag: platformFlag });

  const withSession = async (fn) => {
    const session = await platform.openSession();
    try {
      return await fn(session);
    } finally {
      session.close();
    }
  };

  if (command === 'snap') {
    await withSession(async (session) =>
      console.log(formatSnapshot(JSON.parse(await session.evaluate(COLLECT_SNAPSHOT)))),
    );
    return;
  }

  if (command === 'do') {
    const flags = rest.filter((token) => token.startsWith('--'));
    const rawSteps = rest.filter((token) => !token.startsWith('--'));
    if (rawSteps.length === 0) throw new Error('do needs at least one step');
    let timeoutMs;
    for (const flag of flags) {
      const match = /^--timeout=(\d+)$/.exec(flag);
      if (!match) throw new Error(`unknown option "${flag}"`);
      timeoutMs = Number(match[1]);
    }
    const steps = rawSteps.map(parseStep);
    await withSession(async (session) => {
      // `!== undefined`, not a truthiness test: --timeout=0 is a legitimate "fail a wait
      // immediately" and a truthy guard silently substituted the 15000ms default for it.
      const { lines, failed } = await runSteps(session, steps, timeoutMs !== undefined ? { timeoutMs } : {});
      console.log(lines.join('\n'));
      if (failed) process.exitCode = 1;
    });
    return;
  }

  if (command === 'shot') {
    const outPath = rest[0] ?? '.wvd/shot.png';
    mkdirSync(dirname(outPath), { recursive: true });
    console.log(platform.screenshot(outPath));
    return;
  }

  if (command === 'relaunch') {
    const launched = platform.relaunch();
    // ensureReady(), not a bare page wait: on iOS it also starts the proxy or replaces a
    // stale one. relaunch is the command an agent reaches for first, so it is the last
    // place that should assume a healthy transport.
    await platform.ensureReady();
    console.log(launched);
    return;
  }

  if (command === 'clear') {
    const cleared = androidOnly(platform, 'clearData')();
    // pm clear also stops the app, so leaving it dead would make the next command fail with
    // a confusing "not running" instead of just working.
    const launched = platform.relaunch();
    await platform.ensureReady();
    console.log(`cleared ${cleared} -> ${launched}`);
    return;
  }

  if (command === 'bounds') {
    const needle = rest.join(' ');
    if (!needle) throw new Error('bounds needs text to match');
    const found = androidOnly(platform, 'uiBounds')(needle);
    if (!found) {
      throw new Error(`no native view matching "${needle}" — is it on screen?`);
    }
    console.log(`${found.x} ${found.y}   (bounds ${found.bounds.join(',')})`);
    return;
  }

  if (command === 'tap') {
    const [x, y] = rest;
    if (!/^\d+$/.test(x ?? '') || !/^\d+$/.test(y ?? '')) throw new Error('tap needs <x> <y> in device pixels');
    console.log(androidOnly(platform, 'tap')(Number(x), Number(y)));
    return;
  }

  if (command === 'logs') {
    const count = rest[0] ? Number(rest[0]) : 20;
    if (!Number.isInteger(count) || count <= 0) throw new Error(`logs needs a positive count, got "${rest[0]}"`);
    await withSession(async (session) => {
      const payload = JSON.parse(await session.evaluate(LOG_TAIL(count)));
      if (payload.missing) {
        throw new Error(
          'window.__adaptyDevtoolsLogs is not published — the running bundle predates the LogsContext change; rebuild and redeploy the app',
        );
      }
      console.log(formatLogs(payload));
    });
    return;
  }

  if (command === 'native') {
    let seconds = 60;
    let level = null;
    let maxMessage = 200;
    for (const flag of rest) {
      const seconds_ = /^--seconds=(\d+)$/.exec(flag);
      const level_ = /^--level=(\w+)$/.exec(flag);
      if (seconds_) seconds = Number(seconds_[1]);
      else if (level_) level = level_[1];
      else if (flag === '--full') maxMessage = Number.MAX_SAFE_INTEGER;
      else throw new Error(`unknown option "${flag}"`);
    }
    let entries = platform.parseNativeLog(platform.nativeLog({ seconds }));
    if (level) entries = filterByLevel(entries, level);
    console.log(formatNativeLog(entries, { window: `${seconds}s`, maxMessage, subsystem: platform.subsystem }));
    return;
  }

  if (command === 'scenario') {
    const [name, ...flags] = rest;
    if (!name) throw new Error(`scenario needs a name — known: ${SCENARIO_NAMES.join(', ')}`);
    const options = {};
    let fresh = true;
    for (const flag of flags) {
      if (flag === '--no-relaunch') {
        fresh = false;
        continue;
      }
      const match = /^--(placement|locale)=(.+)$/.exec(flag);
      if (!match) throw new Error(`unknown scenario option "${flag}"`);
      options[match[1]] = match[2];
    }
    const steps = scenarioSteps(name, options).map(parseStep);
    if (fresh) {
      // A repeat activate throws and unmounts every section, and a stale flow keeps
      // the Present button enabled — so a dirty session makes this scenario lie.
      console.log(`relaunched: ${platform.relaunch()}`);
      // see the relaunch command — a dead transport must not read as a dead page
      await platform.ensureReady();
    }
    await withSession(async (session) => {
      const { lines, failed } = await runSteps(session, steps);
      console.log(lines.join('\n'));
      if (failed) process.exitCode = 1;
    });
    return;
  }

  if (command === 'eval') {
    const expression = rest.join(' ');
    if (!expression) throw new Error('eval needs an expression');
    await withSession(async (session) => console.log(render(await session.evaluate(expression))));
    return;
  }

  console.error(USAGE);
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`wvd: ${error?.message ?? error}`);
  process.exitCode = 1;
});
