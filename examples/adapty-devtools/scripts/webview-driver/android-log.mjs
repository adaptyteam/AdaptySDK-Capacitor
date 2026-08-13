// Pure parsing for `adb logcat -v time`, producing the same entry shape as
// native-log.mjs#parseNativeLog so filterByLevel() and formatNativeLog() are shared.

// 08-12 15:31:22.441 V/Adapty_v4.0.1(21846): VERBOSE: GET https://api.adaptytech.com/…
const ENTRY = /^\d{2}-\d{2} (\d{2}:\d{2}:\d{2}\.\d{3}) ([VDIWEF])\/([^(]+)\((\s*\d+)\): ?(.*)$/;

// The Android SDK prints its OWN level as a message prefix, and that is the level to
// report: the logcat priority is lossy by comparison — the SDK maps both verbose and info
// onto priorities that do not round-trip, exactly as AdaptyLogger does on iOS.
const SDK_LEVEL = /^(ERROR|WARN|INFO|VERBOSE|DEBUG): ?(.*)$/;

// Fallback when a record carries no SDK prefix, e.g. a line logged by the Android runtime
// itself under an Adapty tag.
const PRIORITIES = { F: 'error', E: 'error', W: 'warn', I: 'info', D: 'debug', V: 'verbose' };

/** Tags the SDK logs under. The version suffix varies (`Adapty_v4.0.1`), so match a prefix. */
const TAG = /^Adapty/;

/**
 * Keeps only the SDK's own records, mirroring the iOS predicate `subsystem == "io.adapty"`.
 * Without it a 60-second window is ~1100 lines of WindowManager noise, and `wvd native`
 * stops being readable — the one property that makes the iOS command useful.
 */
export function parseAndroidLog(raw, { tagFilter = TAG } = {}) {
  const entries = [];

  for (const line of raw.split('\n')) {
    const head = ENTRY.exec(line.replace(/\r$/, ''));
    if (!head) {
      // A continuation of the previous record: the SDK prints multi-line request dumps and
      // logcat emits each physical line separately, so appending keeps them together the
      // way parseNativeLog does on iOS.
      if (entries.length && line.trim() && !/^-{5,}/.test(line)) {
        entries[entries.length - 1].message += ` ${line.trim()}`;
      }
      continue;
    }
    const [, time, priority, tag, , rest] = head;
    if (tagFilter && !tagFilter.test(tag.trim())) continue;

    const sdk = SDK_LEVEL.exec(rest);
    entries.push({
      time,
      level: sdk ? sdk[1].toLowerCase() : (PRIORITIES[priority] ?? priority),
      category: 'sdk',
      message: sdk ? sdk[2] : rest,
      source: null,
      // The tag carries the native SDK version — the Android equivalent of the `v4.0.2,
      // Adapty/File.swift#23` trailer iOS emits, and worth keeping for the same reason:
      // it is the only in-log proof of which SDK build produced the line.
      version: /_v([\d.]+)$/.exec(tag.trim())?.[1] ?? null,
    });
  }

  return entries;
}
