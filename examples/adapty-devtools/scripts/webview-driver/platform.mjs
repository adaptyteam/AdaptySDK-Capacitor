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
 * Resolution order: explicit flag, then WVD_PLATFORM, then autodetect.
 *
 * Autodetection refuses to choose when both an iOS simulator and an Android device are
 * available. Guessing there is the one failure mode with no symptom — every command would
 * succeed against the wrong platform and the output would look perfectly normal — so an
 * ambiguous environment is an error that names the flag instead.
 */
export function resolvePlatformName({ flag = null, env = process.env.WVD_PLATFORM, probes } = {}) {
  const wanted = flag ?? (env ? env.toLowerCase() : null);
  if (wanted) {
    if (wanted !== 'ios' && wanted !== 'android') {
      throw new Error(`unknown platform "${wanted}" — use ios or android`);
    }
    return wanted;
  }

  const { hasSimulator, hasAndroid } = probes;
  if (hasSimulator && hasAndroid) {
    throw new Error(
      'both a booted iOS simulator and an attached Android device are present — pass --ios or --android (or set WVD_PLATFORM)',
    );
  }
  if (hasSimulator) return 'ios';
  if (hasAndroid) return 'android';
  throw new Error('no booted iOS simulator and no attached Android device');
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

/** True/false probes, each swallowing its own failure so autodetect can ask both. */
async function probe() {
  const [{ bootedUdid }, { deviceSerial }] = await Promise.all([
    import('./simulator.mjs'),
    import('./android-device.mjs'),
  ]);
  const ok = (fn) => {
    try {
      fn();
      return true;
    } catch {
      return false;
    }
  };
  return { hasSimulator: ok(bootedUdid), hasAndroid: ok(deviceSerial) };
}

export async function resolvePlatform({ flag = null } = {}) {
  const name = resolvePlatformName({ flag, probes: await probe() });

  if (name === 'ios') {
    const [inspector, simulator, nativeLog] = await Promise.all([
      import('./inspector.mjs'),
      import('./simulator.mjs'),
      import('./native-log.mjs'),
    ]);
    return {
      name,
      subsystem: 'io.adapty',
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
