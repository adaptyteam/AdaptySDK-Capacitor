#!/usr/bin/env node
/**
 * Toggles Adapty Kids Mode (COPPA / App Store Kids Category) for iOS.
 *
 * Flips this package's default trait set in Package.swift between
 * `.default(enabledTraits: [])` and `.default(enabledTraits: ["AdaptyCapacitorKidsMode"])`.
 * The trait forwards to the native `KidsMode` trait of AdaptySDK-iOS, which
 * compiles out all IDFA / AdSupport / AppTrackingTransparency code.
 *
 * Intended to run from the consumer app's package.json:
 *   "scripts": { "postinstall": "adapty-kids-mode" }
 * so the patch is re-applied on every install. Commands: enable (default), disable.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TRAIT_NAME = 'AdaptyCapacitorKidsMode';
const ANCHOR_DISABLED = '.default(enabledTraits: [])';
const ANCHOR_ENABLED = `.default(enabledTraits: ["${TRAIT_NAME}"])`;

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

function runCli(argv, manifestPath) {
  const command = argv[0] ?? 'enable';
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
  return 0;
}

module.exports = { applyKidsMode, runCli, ANCHOR_DISABLED, ANCHOR_ENABLED, TRAIT_NAME };

if (require.main === module) {
  const manifestPath = path.join(__dirname, '..', 'Package.swift');
  try {
    process.exitCode = runCli(process.argv.slice(2), manifestPath);
  } catch (err) {
    console.error(`adapty-kids-mode: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
