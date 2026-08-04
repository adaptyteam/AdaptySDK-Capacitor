// Expressions evaluated inside the app's WebView.
//
// Each is a single expression (Runtime.evaluate takes an expression, not a program)
// and returns a primitive or a JSON string, because returnByValue cannot serialize
// DOM nodes.
//
// Helper failures come back as { err } objects, never as strings: `set` echoes the
// value it wrote, so a string sentinel would collide with legitimate data.

/**
 * Installs window.__wvd. Assigned unconditionally — the page outlives every wvd
 * invocation, so a `||` guard would pin whichever version was installed first and
 * silently run stale helpers after this file changes.
 *
 * set() goes through the native prototype setter because React tracks input values
 * internally: a plain `el.value = x` is swallowed on the next render.
 */
export const HELPERS_SOURCE = `(() => {
  const FORM = { INPUT: HTMLInputElement, TEXTAREA: HTMLTextAreaElement, SELECT: HTMLSelectElement };
  window.__wvd = {
    set: (id, value) => {
      const el = document.getElementById(id);
      if (!el) return { err: 'no #' + id };
      const ctor = FORM[el.tagName];
      // Clickable non-button controls are plain <div>s here; calling the input
      // prototype's setter on one throws "Illegal invocation".
      if (!ctor) return { err: 'not settable #' + id + ' (<' + el.tagName.toLowerCase() + '>)' };
      Object.getOwnPropertyDescriptor(ctor.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      return el.value;
    },
    click: (id) => {
      const el = document.getElementById(id);
      if (!el) return { err: 'no #' + id };
      if (el.disabled) return { err: 'disabled #' + id };
      el.click();
      return 'ok';
    },
    read: (id) => {
      const el = document.getElementById(id);
      if (!el) return { err: 'no #' + id };
      if (FORM[el.tagName]) return el.value;
      return (el.textContent || '').replace(/\\s+/g, ' ').trim();
    },
    ready: (id, want) => {
      const el = document.getElementById(id);
      if (!el) return want === 'absent' ? 'absent' : false;
      if (want === 'absent') return false;
      if (want === 'enabled') return el.disabled ? false : 'enabled';
      if (want === 'disabled') return el.disabled ? 'disabled' : false;
      return 'present';
    },
  };
  return 'ok';
})()`;

/** Collects every element carrying an id. Returns a JSON string; Node formats it. */
export const COLLECT_SNAPSHOT = `(() => {
  const rows = [];
  for (const el of document.querySelectorAll('[id]')) {
    if (el.id === 'root') continue;
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();
    const row = { id: el.id };
    if (tag === 'input' || tag === 'textarea' || tag === 'select') row.value = el.value;
    else {
      const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text) row.text = text;
    }
    if (el.disabled) row.disabled = true;
    if (!(rect.width > 0 && rect.height > 0)) row.hidden = true;
    rows.push(row);
  }
  return JSON.stringify({ route: location.hash || '#/', rows });
})()`;

/**
 * Returns the last n log entries published by LogsContext, oldest first.
 * The array is newest-last as LogsContext appends, so a plain slice(-n) is the tail.
 */
export const LOG_TAIL = (n) => `(() => {
  const all = window.__adaptyDevtoolsLogs;
  if (!Array.isArray(all)) {
    return JSON.stringify({ total: 0, logs: [], missing: true });
  }
  // Local time, matching formatDate() in src/helpers.ts, so a timestamp here can be
  // compared against what the /logs screen shows.
  const pad = (value, width) => String(value).padStart(width, '0');
  const stamp = (iso) => {
    const d = new Date(iso);
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) +
      '.' + pad(d.getMilliseconds(), 3);
  };
  const logs = all.slice(-${Number(n)}).map((entry) => ({
    time: stamp(entry.isoDate),
    level: entry.logLevel,
    funcName: entry.funcName,
    message: entry.message,
    isSDK: !!entry.isSDK,
  }));
  return JSON.stringify({ total: all.length, logs });
})()`;
