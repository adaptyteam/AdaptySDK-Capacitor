/* eslint-env jest */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkSync, isMachO, isObjcClassDefined, listMachO, resolvedPin, runCli } = require('../check-ios-app.cjs');

const CAP_CONFIG = JSON.stringify({
  appId: 'com.example.plugin',
  packageClassList: ['AdaptyCapacitorPlugin', 'AppPlugin'],
});

const SPM_MANIFEST = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapApp-SPM",
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.1"),
        .package(name: "AdaptyCapacitor", path: "../../../../..")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "AdaptyCapacitor", package: "AdaptyCapacitor")
            ]
        )
    ]
)
`;

const MACHO_64 = Buffer.from('cffaedfe0c000001', 'hex');
const MACHO_FAT = Buffer.from('cafebabe00000002', 'hex');
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

function captureIo() {
  const out = { log: [], error: [] };
  return { out, io: { log: (m) => out.log.push(m), error: (m) => out.error.push(m) } };
}

function makeApp(files) {
  const app = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'check-ios-app-')), 'App.app');
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(app, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return app;
}

describe('checkSync', () => {
  test('passes for a synced SPM app', () => {
    expect(checkSync({ capConfigJson: CAP_CONFIG, spmManifest: SPM_MANIFEST })).toEqual([]);
  });

  test('passes without an SPM manifest (pods)', () => {
    expect(checkSync({ capConfigJson: CAP_CONFIG })).toEqual([]);
  });

  test('reports a packageClassList without the plugin', () => {
    const errors = checkSync({ capConfigJson: JSON.stringify({ packageClassList: ['AppPlugin'] }) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('AdaptyCapacitorPlugin');
  });

  test('reports an SPM manifest without the AdaptyCapacitor product', () => {
    const manifest = SPM_MANIFEST.replace('.product(name: "AdaptyCapacitor", package: "AdaptyCapacitor")', '');
    const errors = checkSync({ capConfigJson: CAP_CONFIG, spmManifest: manifest });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('AdaptyCapacitor');
  });
});

describe('isMachO', () => {
  test.each(['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe'])('accepts %s', (magic) => {
    expect(isMachO(Buffer.from(magic, 'hex'))).toBe(true);
  });

  test('rejects PNG, text and short files', () => {
    expect(isMachO(PNG)).toBe(false);
    expect(isMachO(Buffer.from('#!/bin/sh'))).toBe(false);
    expect(isMachO(Buffer.from('ab'))).toBe(false);
  });
});

describe('listMachO', () => {
  test('finds a debug dylib and a framework binary', () => {
    const app = makeApp({
      App: 'stub text',
      'App.debug.dylib': MACHO_64,
      'Frameworks/AdaptyCapacitor.framework/AdaptyCapacitor': MACHO_FAT,
      'public/index.html': '<!doctype html>',
    });
    expect(listMachO(app).sort()).toEqual(
      [
        path.join(app, 'App.debug.dylib'),
        path.join(app, 'Frameworks/AdaptyCapacitor.framework/AdaptyCapacitor'),
      ].sort(),
    );
  });

  test('accepts fat and thin magics and skips data files', () => {
    const app = makeApp({
      App: MACHO_64,
      'Frameworks/Capacitor.framework/Capacitor': MACHO_FAT,
      'splash.png': PNG,
      'capacitor.config.json': CAP_CONFIG,
    });
    fs.symlinkSync(path.join(app, 'App'), path.join(app, 'Frameworks/Link'));
    expect(listMachO(app).sort()).toEqual(
      [path.join(app, 'App'), path.join(app, 'Frameworks/Capacitor.framework/Capacitor')].sort(),
    );
  });
});

describe('isObjcClassDefined', () => {
  test('accepts a defined class', () => {
    expect(isObjcClassDefined('0000000100012345 S _OBJC_CLASS_$_AdaptyCapacitorPlugin', 'AdaptyCapacitorPlugin')).toBe(
      true,
    );
  });

  test('ignores an undefined reference', () => {
    expect(isObjcClassDefined('                 U _OBJC_CLASS_$_AdaptyCapacitorPlugin', 'AdaptyCapacitorPlugin')).toBe(
      false,
    );
  });

  test('ignores a class with the same prefix', () => {
    expect(
      isObjcClassDefined('0000000100012345 S _OBJC_CLASS_$_AdaptyCapacitorPluginHelper', 'AdaptyCapacitorPlugin'),
    ).toBe(false);
  });
});

describe('resolvedPin', () => {
  const resolved = JSON.stringify({
    pins: [
      { identity: 'capacitor-swift-pm', state: { version: '8.0.1' } },
      { identity: 'adaptysdk-ios', kind: 'remoteSourceControl', state: { revision: 'abc', version: '4.2.0' } },
    ],
  });

  test('returns the AdaptySDK-iOS state', () => {
    expect(resolvedPin(resolved)).toEqual({ revision: 'abc', version: '4.2.0' });
  });

  test('returns null without the pin', () => {
    expect(resolvedPin(JSON.stringify({ pins: [{ identity: 'capacitor-swift-pm', state: {} }] }))).toBeNull();
  });
});

describe('runCli', () => {
  test('linked passes and names the binary that defines the class', () => {
    const app = makeApp({ App: MACHO_64, 'App.debug.dylib': MACHO_64 });
    const nm = (file) => (file.endsWith('.dylib') ? '0000000100012345 S _OBJC_CLASS_$_AdaptyCapacitorPlugin' : '');
    const { out, io } = captureIo();
    expect(runCli(['linked', `--app=${app}`], io, { nm })).toBe(0);
    expect(out.log.join('\n')).toContain('App.debug.dylib');
  });

  test('linked fails with FATAL naming the binary when nm throws', () => {
    const app = makeApp({ App: MACHO_64 });
    const nm = () => {
      throw new Error('spawnSync nm ENOBUFS');
    };
    const { out, io } = captureIo();
    expect(runCli(['linked', `--app=${app}`], io, { nm })).toBe(1);
    expect(out.error.join('\n')).toContain(`FATAL: nm failed on ${path.join(app, 'App')}`);
  });

  test('linked fails when no binary defines the class', () => {
    const app = makeApp({ App: MACHO_64 });
    const { out, io } = captureIo();
    expect(runCli(['linked', `--app=${app}`], io, { nm: () => '' })).toBe(1);
    expect(out.error.join('\n')).toContain('AdaptyCapacitorPlugin');
  });

  test('linked fails when the app has no Mach-O at all', () => {
    const app = makeApp({ 'public/index.html': '<!doctype html>' });
    const { out, io } = captureIo();
    expect(runCli(['linked', `--app=${app}`], io, { nm: () => '' })).toBe(1);
    expect(out.error.join('\n')).toMatch(/FATAL/);
  });

  test('sync reads the app dir and fails on a missing plugin', () => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ios-sync-'));
    fs.mkdirSync(path.join(appDir, 'App'));
    fs.writeFileSync(path.join(appDir, 'App/capacitor.config.json'), JSON.stringify({ packageClassList: [] }));
    const { out, io } = captureIo();
    expect(runCli(['sync', `--app-dir=${appDir}`], io)).toBe(1);
    expect(out.error.join('\n')).toContain('AdaptyCapacitorPlugin');
  });

  test('sync checks CapApp-SPM when present', () => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ios-sync-'));
    fs.mkdirSync(path.join(appDir, 'App'));
    fs.mkdirSync(path.join(appDir, 'CapApp-SPM'));
    fs.writeFileSync(path.join(appDir, 'App/capacitor.config.json'), CAP_CONFIG);
    fs.writeFileSync(path.join(appDir, 'CapApp-SPM/Package.swift'), SPM_MANIFEST);
    const { io } = captureIo();
    expect(runCli(['sync', `--app-dir=${appDir}`], io)).toBe(0);
  });

  test('pin fails when the file is absent', () => {
    const { out, io } = captureIo();
    expect(runCli(['pin', '--resolved=/nonexistent/Package.resolved'], io)).toBe(1);
    expect(out.error.join('\n')).toMatch(/FATAL/);
  });
});
