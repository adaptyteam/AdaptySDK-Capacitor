/* eslint-env jest */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  applyKidsMode,
  collectWarnings,
  runCli,
  ANCHOR_DISABLED,
  ANCHOR_ENABLED,
  TRAIT_NAME,
} = require('../kids-mode.cjs');

const FIXTURE = `// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "AdaptyCapacitor",
    traits: [
        .default(enabledTraits: []),
        .trait(
            name: "AdaptyCapacitorKidsMode",
            description: "COPPA build."
        )
    ]
)
`;

describe('applyKidsMode', () => {
  it('enables the trait in a pristine manifest', () => {
    const result = applyKidsMode(FIXTURE, true);
    expect(result.changed).toBe(true);
    expect(result.text).toContain(ANCHOR_ENABLED);
    expect(result.text).not.toContain(ANCHOR_DISABLED);
  });

  it('is a no-op when already enabled', () => {
    const enabled = applyKidsMode(FIXTURE, true).text;
    const again = applyKidsMode(enabled, true);
    expect(again.changed).toBe(false);
    expect(again.text).toBe(enabled);
  });

  it('disable after enable restores the manifest byte-for-byte', () => {
    const enabled = applyKidsMode(FIXTURE, true).text;
    const restored = applyKidsMode(enabled, false);
    expect(restored.changed).toBe(true);
    expect(restored.text).toBe(FIXTURE);
  });

  it('is a no-op when already disabled', () => {
    const result = applyKidsMode(FIXTURE, false);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(FIXTURE);
  });

  it('throws loudly when the anchor is missing', () => {
    expect(() => applyKidsMode('let package = Package()', true)).toThrow(/anchor not found/i);
    expect(() => applyKidsMode('let package = Package()', false)).toThrow(/anchor not found/i);
  });
});

describe('runCli', () => {
  let dir;
  let manifestPath;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapty-kids-mode-'));
    manifestPath = path.join(dir, 'Package.swift');
    fs.writeFileSync(manifestPath, FIXTURE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to enable and patches the manifest', () => {
    expect(runCli([], manifestPath)).toBe(0);
    expect(fs.readFileSync(manifestPath, 'utf8')).toContain(ANCHOR_ENABLED);
  });

  it('enable twice is idempotent', () => {
    runCli(['enable'], manifestPath);
    expect(runCli(['enable'], manifestPath)).toBe(0);
    expect(fs.readFileSync(manifestPath, 'utf8')).toContain(ANCHOR_ENABLED);
  });

  it('disable restores the original file byte-for-byte', () => {
    runCli(['enable'], manifestPath);
    expect(runCli(['disable'], manifestPath)).toBe(0);
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(FIXTURE);
  });

  it('rejects unknown commands with exit code 2 and leaves the file untouched', () => {
    expect(runCli(['frobnicate'], manifestPath)).toBe(2);
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(FIXTURE);
  });

  it('propagates the missing-anchor error', () => {
    fs.writeFileSync(manifestPath, 'let package = Package()');
    expect(() => runCli(['enable'], manifestPath)).toThrow(/anchor not found/i);
  });
});

describe('collectWarnings', () => {
  const PODFILE = `target 'App' do\n  capacitor_pods\n  adapty_pods!\nend\n`;
  const POST_INSTALL = `post_install do |installer|\n  assertDeploymentTarget(installer)\n  adapty_enable_kids_mode(installer)\nend\n`;
  let nativeDir;

  beforeEach(() => {
    nativeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapty-kids-mode-app-'));
  });

  afterEach(() => {
    fs.rmSync(nativeDir, { recursive: true, force: true });
  });

  const writePodfile = (text) => fs.writeFileSync(path.join(nativeDir, 'Podfile'), text);

  it('warns that enable does nothing in a CocoaPods app without the Podfile helper', () => {
    writePodfile(PODFILE);
    const warnings = collectWarnings(nativeDir, true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Kids Mode is NOT active/);
    expect(warnings[0]).toContain('adapty_enable_kids_mode(installer)');
  });

  it('does not count a commented-out helper call', () => {
    writePodfile(PODFILE + POST_INSTALL.replace('  adapty_enable_kids_mode', '  # adapty_enable_kids_mode'));
    expect(collectWarnings(nativeDir, true)[0]).toMatch(/Kids Mode is NOT active/);
  });

  it('stays quiet when the Podfile enables Kids Mode itself', () => {
    writePodfile(PODFILE + POST_INSTALL);
    expect(collectWarnings(nativeDir, true)).toEqual([]);
  });

  it('warns that disable leaves Kids Mode on while the Podfile enables it', () => {
    writePodfile(PODFILE + POST_INSTALL);
    expect(collectWarnings(nativeDir, false)[0]).toMatch(/Kids Mode stays ON/);
  });

  it('stays quiet on disable in a CocoaPods app without the helper', () => {
    writePodfile(PODFILE);
    expect(collectWarnings(nativeDir, false)).toEqual([]);
  });

  it('stays quiet in an SPM app', () => {
    fs.mkdirSync(path.join(nativeDir, 'CapApp-SPM'));
    expect(collectWarnings(nativeDir, true)).toEqual([]);
  });

  it('warns when no iOS project is found', () => {
    expect(collectWarnings(nativeDir, true)[0]).toMatch(/no iOS project found/);
  });
});

describe('runCli warnings', () => {
  let dir;
  let manifestPath;
  let appRoot;
  let warn;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapty-kids-mode-'));
    manifestPath = path.join(dir, 'Package.swift');
    fs.writeFileSync(manifestPath, FIXTURE);
    appRoot = path.join(dir, 'app');
    fs.mkdirSync(path.join(appRoot, 'ios', 'App'), { recursive: true });
    fs.writeFileSync(path.join(appRoot, 'ios', 'App', 'Podfile'), "target 'App' do\nend\n");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('warns about the CocoaPods app at the app root and still patches the manifest', () => {
    expect(runCli(['enable'], manifestPath, appRoot, { env: {} })).toBe(0);
    expect(fs.readFileSync(manifestPath, 'utf8')).toContain(ANCHOR_ENABLED);
    expect(warn.mock.calls.flat().join('\n')).toMatch(/Kids Mode is NOT active/);
  });

  it('takes the app root from --app-root', () => {
    expect(runCli(['enable', `--app-root=${appRoot}`], manifestPath, dir, { env: {} })).toBe(0);
    expect(warn.mock.calls.flat().join('\n')).toMatch(/Kids Mode is NOT active/);
  });

  it('is silenced by --no-warnings', () => {
    runCli(['enable', '--no-warnings'], manifestPath, appRoot, { env: {} });
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silenced by ADAPTY_KIDS_MODE_NO_WARNINGS=1', () => {
    runCli(['enable'], manifestPath, appRoot, { env: { ADAPTY_KIDS_MODE_NO_WARNINGS: '1' } });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('shipped Package.swift', () => {
  const manifest = fs.readFileSync(path.join(__dirname, '..', '..', 'Package.swift'), 'utf8');

  it('ships with Kids Mode disabled and the anchor intact', () => {
    expect(manifest).toContain(ANCHOR_DISABLED);
  });

  it('forwards the native KidsMode trait from our trait (guards against version-bump edits dropping it)', () => {
    expect(manifest).toContain(`.trait(name: "KidsMode", condition: .when(traits: ["${TRAIT_NAME}"]))`);
  });
});
