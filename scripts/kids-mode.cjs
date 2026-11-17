#!/usr/bin/env node
/**
 * Toggles Adapty Kids Mode (COPPA / App Store Kids Category) for iOS apps on Swift Package Manager.
 *
 * Flips this package's default trait set in Package.swift between
 * `.default(enabledTraits: [])` and `.default(enabledTraits: ["AdaptyCapacitorKidsMode"])`.
 * The trait forwards to the native `KidsMode` trait of AdaptySDK-iOS, which
 * compiles out all IDFA / AdSupport / AppTrackingTransparency code.
 *
 * Intended to run from the consumer app's package.json:
 *   "scripts": { "postinstall": "adapty-kids-mode" }
 * so the patch is re-applied on every install. Commands: enable (default), disable.
 * Flags: --app-root=<path> when the app is not at INIT_CWD;
 *        --no-warnings (or ADAPTY_KIDS_MODE_NO_WARNINGS=1) to silence the checks below.
 *
 * The checks never fail the install — they warn. A CocoaPods app is the one that matters: it never
 * reads Package.swift, so the patch applies but changes nothing; there Kids Mode is
 * `adapty_enable_kids_mode(installer)` from ios/adapty_podfile.rb in the Podfile.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TRAIT_NAME = 'AdaptyCapacitorKidsMode';
const ANCHOR_DISABLED = '.default(enabledTraits: [])';
const ANCHOR_ENABLED = `.default(enabledTraits: ["${TRAIT_NAME}"])`;
const DOCS_URL = 'https://adapty.io/docs/kids-mode-capacitor';

function applyKidsMode(manifestText, enabled) {
  const from = enabled ? ANCHOR_DISABLED : ANCHOR_ENABLED;
  const to = enabled ? ANCHOR_ENABLED : ANCHOR_DISABLED;
  if (manifestText.includes(to)) {
    return { text: manifestText, changed: false };
  }
  if (!manifestText.includes(from)) {
    throw new Error(
      `Kids Mode anchor not found in Package.swift: expected "${from}" or "${to}". ` +
        'The manifest format may have changed — do not ship a kids-category build until this is resolved.',
    );
  }
  return { text: manifestText.replace(from, to), changed: true };
}

/** The native project of a Capacitor app: `ios/App`, holding a Podfile or CapApp-SPM. */
function resolveNativeProjectDir(appRoot) {
  return path.join(appRoot, 'ios', 'App');
}

function readPodfile(nativeProjectDir) {
  try {
    return fs.readFileSync(path.join(nativeProjectDir, 'Podfile'), 'utf8');
  } catch {
    return null;
  }
}

/** Whether an uncommented line of the Podfile calls the helper. */
function podfileEnablesKidsMode(podfile) {
  return /^[ \t]*adapty_enable_kids_mode\b/m.test(podfile);
}

/**
 * Reasons the manifest patch may not decide what the build gets. Only files of the app's repo are
 * read, so the checks work on any OS, not just the machine that builds iOS.
 */
function collectWarnings(nativeProjectDir, enabled) {
  const podfile = readPodfile(nativeProjectDir);
  if (podfile !== null) {
    const podsKidsMode = podfileEnablesKidsMode(podfile);
    if (enabled && !podsKidsMode) {
      return [
        'adapty-kids-mode: WARNING — this app integrates iOS through CocoaPods, where Package.swift\n' +
          '  is never read. Kids Mode is NOT active: the build still links AdSupport.\n' +
          `  Add \`adapty_enable_kids_mode(installer)\` to the post_install block in ${path.join(nativeProjectDir, 'Podfile')}.\n` +
          `  Docs: ${DOCS_URL}`,
      ];
    }
    if (!enabled && podsKidsMode) {
      return [
        'adapty-kids-mode: WARNING — this app integrates iOS through CocoaPods, where Package.swift\n' +
          '  is never read. Kids Mode stays ON: the Podfile calls `adapty_enable_kids_mode`.',
      ];
    }
    return [];
  }
  if (!fs.existsSync(path.join(nativeProjectDir, 'CapApp-SPM'))) {
    return [
      `adapty-kids-mode: WARNING — no iOS project found in ${nativeProjectDir} (neither a Podfile\n` +
        '  nor CapApp-SPM), so it is unknown whether Kids Mode reaches the build. If the app lives\n' +
        '  elsewhere, pass --app-root=path/to/app; if iOS is not added yet, run `npx cap add ios`.',
    ];
  }
  return [];
}

function runCli(argv, manifestPath, appRoot, options = {}) {
  const { env = process.env } = options;
  const flags = argv.filter((a) => a.startsWith('--'));
  const args = argv.filter((a) => !a.startsWith('--'));
  const appRootFlag = flags.find((a) => a.startsWith('--app-root='));
  const root = appRootFlag ? appRootFlag.slice('--app-root='.length) : appRoot;
  const quiet = flags.includes('--no-warnings') || env.ADAPTY_KIDS_MODE_NO_WARNINGS === '1';

  const command = args[0] ?? 'enable';
  if (command !== 'enable' && command !== 'disable') {
    console.error(`adapty-kids-mode: unknown command "${command}" (expected "enable" or "disable")`);
    return 2;
  }
  const enabled = command === 'enable';
  const source = fs.readFileSync(manifestPath, 'utf8');
  const result = applyKidsMode(source, enabled);
  if (result.changed) {
    fs.writeFileSync(manifestPath, result.text);
    console.log(`adapty-kids-mode: Kids Mode ${enabled ? 'ENABLED' : 'DISABLED'} in ${manifestPath}`);
    console.log(
      'adapty-kids-mode: re-resolve iOS packages now (`npx cap sync ios` or Xcode > Resolve Package Versions).',
    );
  } else {
    console.log(`adapty-kids-mode: Kids Mode already ${enabled ? 'enabled' : 'disabled'} — nothing to do.`);
  }

  // Warn last so it is the final thing on screen, and never fail the install over it.
  if (!quiet && root) {
    for (const warning of collectWarnings(resolveNativeProjectDir(root), enabled)) {
      console.warn(warning);
      console.warn('adapty-kids-mode: silence this with --no-warnings.');
    }
  }
  return 0;
}

module.exports = {
  applyKidsMode,
  collectWarnings,
  podfileEnablesKidsMode,
  resolveNativeProjectDir,
  runCli,
  ANCHOR_DISABLED,
  ANCHOR_ENABLED,
  TRAIT_NAME,
};

if (require.main === module) {
  const manifestPath = path.join(__dirname, '..', 'Package.swift');
  // npm and yarn both set INIT_CWD to the directory the install was started from —
  // the consuming app's root when this runs as its postinstall hook.
  const appRoot = process.env.INIT_CWD || process.cwd();
  try {
    process.exitCode = runCli(process.argv.slice(2), manifestPath, appRoot);
  } catch (err) {
    console.error(`adapty-kids-mode: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
