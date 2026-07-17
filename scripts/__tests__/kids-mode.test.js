/* eslint-env jest */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { applyKidsMode, runCli, ANCHOR_DISABLED, ANCHOR_ENABLED, TRAIT_NAME } = require('../kids-mode.cjs');

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

describe('shipped Package.swift', () => {
  const manifest = fs.readFileSync(path.join(__dirname, '..', '..', 'Package.swift'), 'utf8');

  it('ships with Kids Mode disabled and the anchor intact', () => {
    expect(manifest).toContain(ANCHOR_DISABLED);
  });

  it('forwards the native KidsMode trait from our trait (guards against version-bump edits dropping it)', () => {
    expect(manifest).toContain(`.trait(name: "KidsMode", condition: .when(traits: ["${TRAIT_NAME}"]))`);
  });
});
