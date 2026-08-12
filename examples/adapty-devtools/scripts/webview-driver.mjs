#!/usr/bin/env node
// wvd — drives the devtools app in the iOS Simulator by element id.
// Run from examples/adapty-devtools. See the drive-devtools-webview skill in .claude/skills/.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensureProxy, openSession, RELAUNCH_SETTLE_MS } from './webview-driver/inspector.mjs';
import { filterByLevel, formatNativeLog, parseNativeLog } from './webview-driver/native-log.mjs';
import { COLLECT_SNAPSHOT, LOG_TAIL } from './webview-driver/page-script.mjs';
import { runSteps } from './webview-driver/runner.mjs';
import { SCENARIO_NAMES, scenarioSteps } from './webview-driver/scenario.mjs';
import { nativeLog, relaunch, screenshot } from './webview-driver/simulator.mjs';
import { formatLogs, formatSnapshot, parseStep } from './webview-driver/steps.mjs';

const USAGE = `usage: yarn wvd <command>

  snap                 print a compact text snapshot of every element with an id
  logs [n]             print the last n log entries (default 20)
  native [--seconds=N]  print the native iOS SDK log (os_log, subsystem io.adapty)
                        options: --level=error|warn|info|verbose|debug --full
  do <step>...         run steps in one session; stops at the first failure
                       set:<id>=<value> | click:<id> | read:<id> | sleep:<ms> | snap
                       wait:<id>[:enabled|:disabled|:absent]
                       option: --timeout=<ms> (default 15000) for wait steps
  shot [path]          screenshot the simulator, downscaled (default .wvd/shot.png)
  relaunch             terminate and relaunch the app — clears a stuck native view
  scenario flow        activate -> load flow -> present -> dismiss
                       relaunches the app first for a clean session
                       options: --placement=<id> --locale=<code> --no-relaunch
  eval <expression>    evaluate JavaScript in the app's WebView
`;

const [command, ...rest] = process.argv.slice(2);

const render = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

async function main() {
  if (command === 'snap') {
    const session = await openSession();
    try {
      console.log(formatSnapshot(JSON.parse(await session.evaluate(COLLECT_SNAPSHOT))));
    } finally {
      session.close();
    }
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
    const session = await openSession();
    try {
      // `!== undefined`, not a truthiness test: --timeout=0 is a legitimate "fail a wait
      // immediately" and a truthy guard silently substituted the 15000ms default for it.
      const { lines, failed } = await runSteps(session, steps, timeoutMs !== undefined ? { timeoutMs } : {});
      console.log(lines.join('\n'));
      if (failed) process.exitCode = 1;
    } finally {
      session.close();
    }
    return;
  }

  if (command === 'shot') {
    const outPath = rest[0] ?? '.wvd/shot.png';
    mkdirSync(dirname(outPath), { recursive: true });
    console.log(screenshot(outPath));
    return;
  }

  if (command === 'relaunch') {
    const launched = relaunch();
    // ensureProxy(), not waitForPage(): both wait for the new WebView, but only this one
    // starts the proxy or replaces a stale one. relaunch is the command an agent reaches
    // for first, so it is the last place that should assume a healthy proxy.
    await ensureProxy({ settleMs: RELAUNCH_SETTLE_MS });
    console.log(launched);
    return;
  }

  if (command === 'logs') {
    const count = rest[0] ? Number(rest[0]) : 20;
    if (!Number.isInteger(count) || count <= 0) throw new Error(`logs needs a positive count, got "${rest[0]}"`);
    const session = await openSession();
    try {
      const payload = JSON.parse(await session.evaluate(LOG_TAIL(count)));
      if (payload.missing) {
        throw new Error(
          'window.__adaptyDevtoolsLogs is not published — the running bundle predates the LogsContext change; rebuild and redeploy the app',
        );
      }
      console.log(formatLogs(payload));
    } finally {
      session.close();
    }
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
    let entries = parseNativeLog(nativeLog({ seconds }));
    if (level) entries = filterByLevel(entries, level);
    console.log(formatNativeLog(entries, { window: `${seconds}s`, maxMessage }));
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
      console.log(`relaunched: ${relaunch()}`);
      // see the relaunch command — a dead proxy must not read as a dead page
      await ensureProxy({ settleMs: RELAUNCH_SETTLE_MS });
    }
    const session = await openSession();
    try {
      const { lines, failed } = await runSteps(session, steps);
      console.log(lines.join('\n'));
      if (failed) process.exitCode = 1;
    } finally {
      session.close();
    }
    return;
  }

  if (command === 'eval') {
    const expression = rest.join(' ');
    if (!expression) throw new Error('eval needs an expression');
    const session = await openSession();
    try {
      console.log(render(await session.evaluate(expression)));
    } finally {
      session.close();
    }
    return;
  }

  console.error(USAGE);
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`wvd: ${error?.message ?? error}`);
  process.exitCode = 1;
});
