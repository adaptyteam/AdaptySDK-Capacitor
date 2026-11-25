// Type-only imports: Node loads this file with type stripping in scripts/app-message.test.mts
import type { AdaptyFlowMessage, AdaptyFlowMessageValue, FlowViewController } from '@adapty/capacitor';

export const DEFAULT_APP_MESSAGE_JSON = '{"action":"confirmed","userCustomId":"confirm_upgrade"}';

export type AppMessageParseResult = { payload: AdaptyFlowMessage } | { error: string };

export type AppMessageSendResult = { ok: true } | { ok: false; error: string };

// JSON.parse turns overflowing numbers (1e400) into Infinity, which is sent as null.
// Iterative, no spread: deep or wide JSON must not overflow the stack here
const hasNonFinite = (root: unknown): boolean => {
  const stack: unknown[] = [root];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === 'number' && !Number.isFinite(value)) return true;
    if (typeof value === 'object' && value !== null) {
      for (const child of Object.values(value)) stack.push(child);
    }
  }
  return false;
};

// The payload must be a JSON object: arrays and primitives are rejected.
export function parseAppMessageJson(json: string): AppMessageParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { error: 'not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: 'expected a JSON object' };
  }
  try {
    if (hasNonFinite(parsed)) return { error: 'non-finite' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  // JSON.parse output is JSON, so the cast only narrows the type
  return { payload: parsed as AdaptyFlowMessage };
}

// Same JSON rules as parseAppMessageJson, for values that did not come from JSON.parse
const isFlowMessageValue = (root: unknown): boolean => {
  const stack: unknown[] = [root];
  while (stack.length) {
    const value = stack.pop();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return false;
      continue;
    }
    if (typeof value !== 'object') return false;
    for (const child of Object.values(value)) stack.push(child);
  }
  return true;
};

// Narrows custom action args to a message value; undefined when they are not JSON
export function toFlowMessageValue(value: unknown): AdaptyFlowMessageValue | undefined {
  return isFlowMessageValue(value) ? (value as AdaptyFlowMessageValue) : undefined;
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'adaptyCode' in error
      ? (error as { adaptyCode: unknown }).adaptyCode
      : undefined;
  if (code === undefined) return message;
  const tag = `#${String(code)}`;
  // SDK errors already start with their code: '#3001 (wrongParam): ...'
  const hasTag = message.startsWith(tag) && !/\d/.test(message.charAt(tag.length));
  return hasTag ? message : `${tag} ${message}`;
}

// Never throws: the outcome is returned so callers can log it.
export async function sendAppMessageSafe(
  view: Pick<FlowViewController, 'sendAppMessage'> | null,
  payload: AdaptyFlowMessage,
): Promise<AppMessageSendResult> {
  if (!view) {
    return { ok: false, error: 'no flow view: present a flow first' };
  }
  try {
    await view.sendAppMessage(payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
