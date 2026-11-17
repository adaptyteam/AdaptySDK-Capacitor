/* eslint-env jest */
'use strict';

/**
 * Keeps the two iOS manifests in step. SPM builds never read the podspec and CocoaPods builds
 * never read Package.swift, so a drift between them breaks only one kind of consumer app, after
 * release, with no failure in this repo's SPM-only builds.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const PACKAGE = JSON.parse(read('package.json'));
const MANIFEST = read('Package.swift');
const PODSPEC = read('AdaptyCapacitor.podspec');
const PODFILE_HELPER = read('ios/adapty_podfile.rb');

const IOS_SDK_URL = 'https://github.com/adaptyteam/AdaptySDK-iOS.git';

/** The pod name Capacitor CLI declares for a plugin package (`fixName` in @capacitor/cli). */
function capacitorPodName(packageName) {
  const name = packageName
    .replace(/\//g, '_')
    .replace(/-/g, '_')
    .replace(/@/g, '')
    .replace(/_\w/g, (m) => m[1].toUpperCase());
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The AdaptySDK-iOS requirement of Package.swift: `exact`, or a temporary `branch` / `revision`. */
function manifestPin() {
  const afterUrl = MANIFEST.split(`url: "${IOS_SDK_URL}"`)[1];
  expect(afterUrl).toBeDefined();
  const match = afterUrl.match(/^\s*,\s*(exact|branch|revision):\s*"([^"]+)"/);
  expect(match).not.toBeNull();
  return { kind: match[1], value: match[2] };
}

function podspecIosVersion() {
  const match = PODSPEC.match(/^adapty_ios_version = '([^']+)'$/m);
  expect(match).not.toBeNull();
  return match[1];
}

/** `s.dependency 'Name', adapty_ios_version` lines, as [name, version expression]. */
function podspecSdkDependencies() {
  return [...PODSPEC.matchAll(/^\s*s\.dependency '(Adapty\w*)', (\w+)$/gm)].map((m) => [m[1], m[2]]);
}

describe('AdaptyCapacitor.podspec', () => {
  it('is named the way Capacitor CLI declares the plugin pod', () => {
    expect(PODSPEC).toContain(`s.name = '${capacitorPodName(PACKAGE.name)}'`);
  });

  it('depends on the same native SDK products as Package.swift', () => {
    const products = [...MANIFEST.matchAll(/\.product\(name: "(\w+)", package: "AdaptySDK-iOS"\)/g)].map((m) => m[1]);
    expect(podspecSdkDependencies().map(([name]) => name)).toEqual(products);
  });

  it('pins every native SDK pod to adapty_ios_version', () => {
    for (const [, version] of podspecSdkDependencies()) {
      expect(version).toBe('adapty_ios_version');
    }
  });

  const pin = manifestPin();
  // A `branch:` / `revision:` pin is a pre-release state with no published pods to compare with;
  // publish.yml refuses to release from it.
  (pin.kind === 'exact' ? it : it.skip)('pins the native SDK version Package.swift pins', () => {
    expect(podspecIosVersion()).toBe(pin.value);
  });

  it('compiles the sources Package.swift compiles', () => {
    const targetPath = MANIFEST.match(/name: "AdaptyCapacitorPlugin",[\s\S]*?path: "([^"]+)"/)[1];
    expect(targetPath.startsWith('ios/Sources')).toBe(true);
    expect(PODSPEC).toContain("s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'");
  });
});

describe('ios/adapty_podfile.rb', () => {
  // The README has Podfiles load the helper by `require.resolve("@adapty/capacitor/ios/adapty_podfile.rb")`.
  it('stays resolvable as a deep import of the package', () => {
    if (PACKAGE.exports !== undefined) {
      expect(JSON.stringify(PACKAGE.exports)).toContain('./ios/adapty_podfile.rb');
    }
    expect(read('README.md')).toContain('"@adapty/capacitor/ios/adapty_podfile.rb"');
  });

  it('pins exactly the native SDK pods the podspec depends on', () => {
    const match = PODFILE_HELPER.match(/PODS = %w\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    expect(match[1].trim().split(/\s+/)).toEqual(podspecSdkDependencies().map(([name]) => name));
  });
});

describe('package.json files', () => {
  it.each(['AdaptyCapacitor.podspec', 'ios/adapty_podfile.rb', 'Package.swift', 'ios/Sources'])(
    'publishes %s',
    (file) => {
      expect(PACKAGE.files).toContain(file);
    },
  );
});
