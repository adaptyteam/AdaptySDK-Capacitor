// Picks the backend once, so webview-driver.mjs never branches on platform.
//
// Every backend exposes the same shape:
//   openSession()      -> { evaluate(expression), close() }
//   ensureReady(opts)  -> resolves when a relaunched app is drivable again
//   relaunch()         -> "<bundle-or-package>: <pid>"
//   screenshot(path)   -> path
//   nativeLog(opts)    -> raw text
//   parseNativeLog(raw)-> entries for filterByLevel/formatNativeLog
//   subsystem          -> what the log scope is called, for the `native` header
//   only               -> commands this backend alone supports

/**
 * Resolution order: --device (or WVD_DEVICE) names the platform with the device, then the
 * explicit flag, then WVD_PLATFORM, then autodetect.
 *
 * Autodetection refuses to choose when both an iOS simulator and an Android device are
 * available. Guessing there is the one failure mode with no symptom — every command would
 * succeed against the wrong platform and the output would look perfectly normal — so an
 * ambiguous environment is an error that names the flag instead.
 */
/** The platform the flag or WVD_PLATFORM asks for, validated; null when neither is set. */
export function wantedPlatform({ flag = null, env = process.env.WVD_PLATFORM } = {}) {
  const wanted = flag ?? (env ? env.toLowerCase() : null);
  if (wanted && wanted !== 'ios' && wanted !== 'android') {
    throw new Error(`unknown platform "${wanted}" — use ios or android`);
  }
  return wanted;
}

export function resolvePlatformName({ flag = null, env = process.env.WVD_PLATFORM, probes } = {}) {
  const wanted = wantedPlatform({ flag, env });
  if (wanted) return wanted;

  const { hasSimulator, hasAndroid } = probes;
  if (hasSimulator && hasAndroid) {
    throw new Error(
      'both a booted iOS simulator and an attached Android device are present — pass --device=<id|name>, ' +
        'or --ios / --android (or set WVD_DEVICE / WVD_PLATFORM)',
    );
  }
  if (hasSimulator) return 'ios';
  if (hasAndroid) return 'android';
  throw new Error(
    `no booted iOS simulator and no attached Android device${probes.detail ? ` (${probes.detail})` : ''}`,
  );
}

/**
 * Waits until the relaunched app has routed, not merely until its WebView answers.
 *
 * Shared by both backends so `relaunch` means the same thing on each. It replaces trusting
 * a fixed settle time: the WebView is inspectable seconds before React mounts, and a
 * snapshot taken in between reports an app with 3 elements in it.
 */
async function waitForApp(openSession, { timeoutMs = 15000 } = {}) {
  const { APP_READY } = await import('./page-script.mjs');
  const deadline = Date.now() + timeoutMs;
  let session = null;
  try {
    session = await openSession();
    while (Date.now() < deadline) {
      if (await session.evaluate(APP_READY)) return;
      await new Promise((done) => setTimeout(done, 200));
    }
  } finally {
    session?.close();
  }
  // Not fatal: the app may legitimately be on a screen this predicate does not recognise,
  // and failing here would break relaunch for a cosmetic reason. The next command will
  // report the real state.
  console.error('wvd: app did not finish routing within the wait — continuing anyway');
}

const UDID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

const orEmpty = (fn) => {
  try {
    return fn();
  } catch {
    return [];
  }
};

export const describeDevice = (d) => (d.name ? `${d.name} ${d.id}` : d.id);

/** Pure: the one device a --device query names — id, then name, then an id prefix of 4+. */
export function matchDevice(devices, query) {
  const q = query.trim().toLowerCase();
  const tiers = [
    (d) => d.id.toLowerCase() === q,
    (d) => (d.name ?? '').toLowerCase() === q,
    (d) => q.length >= 4 && d.id.toLowerCase().startsWith(q),
  ];
  for (const test of tiers) {
    const hits = devices.filter(test);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      throw new Error(`device "${query}" matches several (${hits.map(describeDevice).join(', ')}) — pass the full id`);
    }
  }
  const up = devices.length ? `up: ${devices.map(describeDevice).join(', ')}` : 'none is up';
  throw new Error(`device "${query}" is not a booted simulator or attached Android device — ${up}`);
}

/**
 * The device --device / WVD_DEVICE names. A full UDID or an exact adb serial skips the
 * listing: parallel agents pass --device on every call, so the common case must stay cheap.
 * Anything else is matched against every eligible device at once, so a name a simulator and
 * an AVD share is an error rather than a silent preference for one platform (rn-driver tries
 * simulators first; here the ambiguity is reported).
 */
export async function pinDevice(query, { platform = null } = {}) {
  if (platform !== 'android' && UDID.test(query)) return { platform: 'ios', id: query.toUpperCase(), name: null };
  const [sim, android] = await Promise.all([import('./simulator.mjs'), import('./android-device.mjs')]);
  if (platform !== 'ios' && orEmpty(android.attachedSerials).includes(query)) {
    return { platform: 'android', id: query, name: null };
  }
  return matchDevice(
    [
      ...(platform === 'android' ? [] : orEmpty(sim.bootedSimulators)),
      ...(platform === 'ios' ? [] : orEmpty(android.attachedDevices)),
    ],
    query,
  );
}

/**
 * Pure: the --device value from argv, or null when the flag is absent. A flag given with no
 * value is an error, never "no device": `--device="$SERIAL"` with an empty variable must not
 * fall back to WVD_DEVICE or the only device up — `clear` would wipe the wrong one.
 */
export function parseDeviceFlag(argv) {
  const tokens = argv.filter((token) => token === '--device' || token.startsWith('--device='));
  if (tokens.length === 0) return null;
  if (tokens.length > 1) throw new Error('--device given more than once');
  const value = tokens[0] === '--device' ? '' : tokens[0].slice('--device='.length).trim();
  if (!value) throw new Error('--device needs a value: --device=<udid|serial|name>');
  return value;
}

/**
 * Device presence per platform, each probe swallowing its own failure so autodetect can ask
 * both. Presence, not "exactly one": several booted simulators is still iOS, and the refusal
 * to pick one of them belongs to the command that needs a device, which names --device.
 */
async function probe() {
  const [sim, android] = await Promise.all([import('./simulator.mjs'), import('./android-device.mjs')]);
  // Each probe keeps its failure and the not-ready devices: the error for "no device" is built
  // from this one listing, and must still say why (adb missing, emulator offline, unauthorized).
  const attempt = (fn, empty) => {
    try {
      return { value: fn(), error: null };
    } catch (error) {
      return { value: empty, error: String(error.stderr ?? '').trim() || error.message };
    }
  };
  const sims = attempt(() => sim.bootedSimulators(), []);
  const adb = attempt(() => android.adbDevices(), { ready: [], pending: [] });
  return {
    simulators: sims.value,
    simulatorError: sims.error,
    androids: adb.value.ready.map((id) => ({ platform: 'android', id, name: null })),
    androidPending: adb.value.pending,
    androidError: adb.error,
  };
}

/**
 * Pure: the id of the one device of `platform` an unpinned call drives; with none or several,
 * an error built from this same listing — a second listing could disagree with the first.
 */
export function soleDevice(found, platform) {
  const devices = platform === 'ios' ? found.simulators : found.androids;
  if (devices.length === 1) return devices[0].id;
  if (platform === 'ios') {
    if (devices.length === 0) {
      throw new Error(`no booted simulator${found.simulatorError ? ` — simctl failed: ${found.simulatorError}` : ''}`);
    }
    throw new Error(
      `several booted simulators (${devices.map(describeDevice).join(', ')}) — pass --device=<udid|name> (or set WVD_DEVICE)`,
    );
  }
  if (devices.length === 0) {
    if (found.androidError) throw new Error(`no attached Android device — adb failed: ${found.androidError}`);
    const waiting = found.androidPending?.length ? ` (attached but not ready: ${found.androidPending.join(', ')})` : '';
    throw new Error(`no attached Android device${waiting}`);
  }
  throw new Error(
    `several attached devices (${devices.map((d) => d.id).join(', ')}) — pass --device=<serial|avd name> (or set WVD_DEVICE)`,
  );
}

/** Pure: why the listing found no ready device, from what probe() kept; '' when it has nothing to add. */
export function probeDetail(found) {
  return [
    found.simulatorError && `simctl failed: ${found.simulatorError}`,
    found.androidError && `adb failed: ${found.androidError}`,
    found.androidPending?.length && `not ready: ${found.androidPending.join(', ')}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export async function resolvePlatform({ flag = null, deviceQuery = process.env.WVD_DEVICE || null } = {}) {
  let name;
  let pinnedId = null;
  if (deviceQuery) {
    const pinned = await pinDevice(deviceQuery, { platform: wantedPlatform({ flag }) });
    name = pinned.platform;
    pinnedId = pinned.id;
    const module = await import(name === 'ios' ? './simulator.mjs' : './android-device.mjs');
    module.selectDevice(pinned.id);
  } else {
    // Unpinned is pinned to the only device of the platform, found by the listing autodetect
    // already does — so every later step, the transport included, knows exactly which device
    // it drives, and several devices fail here with the --device hint, warm proxy or not.
    const found = await probe();
    name = resolvePlatformName({
      flag,
      probes: {
        hasSimulator: found.simulators.length > 0,
        hasAndroid: found.androids.length > 0,
        detail: probeDetail(found),
      },
    });
    const only = soleDevice(found, name);
    const module = await import(name === 'ios' ? './simulator.mjs' : './android-device.mjs');
    module.selectDevice(only);
  }

  if (name === 'ios') {
    const [inspector, simulator, nativeLog] = await Promise.all([
      import('./inspector.mjs'),
      import('./simulator.mjs'),
      import('./native-log.mjs'),
    ]);
    return {
      name,
      device: pinnedId,
      // The star is not decoration: the predicate matches io.adapty, io.adapty.ui and
      // io.adapty.capacitor, so a bare `io.adapty` header would understate what was read.
      subsystem: 'io.adapty*',
      openSession: inspector.openSession,
      ensureReady: async () => {
        await inspector.ensureProxy({ settleMs: inspector.RELAUNCH_SETTLE_MS });
        await waitForApp(inspector.openSession);
      },
      relaunch: simulator.relaunch,
      screenshot: simulator.screenshot,
      nativeLog: simulator.nativeLog,
      parseNativeLog: nativeLog.parseNativeLog,
      only: {},
    };
  }

  const [cdp, device, androidLog] = await Promise.all([
    import('./cdp.mjs'),
    import('./android-device.mjs'),
    import('./android-log.mjs'),
  ]);
  return {
    name,
    device: pinnedId,
    subsystem: 'tag Adapty*',
    openSession: cdp.openSession,
    ensureReady: async () => {
      await cdp.ensureProxy({ settleMs: cdp.RELAUNCH_SETTLE_MS });
      await waitForApp(cdp.openSession);
    },
    relaunch: device.relaunch,
    screenshot: device.screenshot,
    nativeLog: device.nativeLog,
    parseNativeLog: androidLog.parseAndroidLog,
    // Android-only, and deliberately not emulated on iOS: `bounds` needs a real view
    // hierarchy, and `clear` has no cheap iOS equivalent (uninstall + install is a minute).
    // A stub that silently did something else would be worse than an honest "not supported".
    only: { uiBounds: device.uiBounds, tap: device.tap, clearData: device.clearData },
  };
}
