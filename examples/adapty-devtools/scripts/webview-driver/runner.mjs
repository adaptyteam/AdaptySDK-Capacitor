// Executes parsed steps against one inspector session.
import { COLLECT_SNAPSHOT, HELPERS_SOURCE } from './page-script.mjs';
import { formatSnapshot } from './steps.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const arg = (value) => JSON.stringify(value);

/** A helper failure is an { err } object; anything else is a legitimate value. */
const errorOf = (result) =>
  result && typeof result === 'object' && typeof result.err === 'string' ? result.err : null;

/**
 * Runs steps in order and stops at the first failure, because a chain built on a
 * missing element only produces more noise after the first one. Every failure —
 * including a rejected evaluate — becomes a line in the log, so the caller always
 * learns which step broke.
 */
export async function runSteps(session, steps, { timeoutMs = 15000, pollMs = 100 } = {}) {
  await session.evaluate(HELPERS_SOURCE);

  const lines = [];
  let failed = false;

  for (const step of steps) {
    let rendered;
    let stepFailed = false;

    try {
      if (step.op === 'set') {
        const result = await session.evaluate(`__wvd.set(${arg(step.id)}, ${arg(step.value)})`);
        [rendered, stepFailed] = describeResult(result);
      } else if (step.op === 'click') {
        const result = await session.evaluate(`__wvd.click(${arg(step.id)})`);
        [rendered, stepFailed] = describeResult(result);
      } else if (step.op === 'read') {
        const result = await session.evaluate(`__wvd.read(${arg(step.id)})`);
        [rendered, stepFailed] = describeResult(result);
      } else if (step.op === 'sleep') {
        await sleep(step.ms);
        rendered = 'slept';
      } else if (step.op === 'snap') {
        rendered = `\n${formatSnapshot(JSON.parse(await session.evaluate(COLLECT_SNAPSHOT)))}`;
      } else if (step.op === 'wait') {
        const expression = `__wvd.ready(${arg(step.id)}, ${arg(step.want)})`;
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          const result = await session.evaluate(expression);
          if (result) {
            rendered = String(result);
            break;
          }
          if (Date.now() >= deadline) {
            rendered = `ERR timeout after ${timeoutMs}ms waiting for #${step.id} to be ${step.want}`;
            stepFailed = true;
            break;
          }
          await sleep(pollMs);
        }
      }
    } catch (error) {
      rendered = `ERR ${error?.message ?? error}`;
      stepFailed = true;
    }

    lines.push(`${describe(step)} -> ${rendered}`);
    if (stepFailed) {
      failed = true;
      break;
    }
  }

  return { lines, failed };
}

function describeResult(result) {
  const err = errorOf(result);
  return err ? [`ERR ${err}`, true] : [String(result), false];
}

function describe(step) {
  if (step.op === 'set') return `set:${step.id}=${step.value}`;
  if (step.op === 'sleep') return `sleep:${step.ms}`;
  if (step.op === 'snap') return 'snap';
  if (step.op === 'wait') return `wait:${step.id}${step.want === 'present' ? '' : `:${step.want}`}`;
  return `${step.op}:${step.id}`;
}
