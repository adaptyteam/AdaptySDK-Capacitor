/* eslint-env jest */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { analyzeR8, pluginClassesFromJson, runCli } = require('../check-r8-keep.cjs');

const PLUGIN = 'com.adapty.plugin.capacitor.AdaptyCapacitorPlugin';

const PLUGINS_JSON = JSON.stringify([
  { pkg: '@adapty/capacitor', classpath: PLUGIN },
  { pkg: '@capacitor/app', classpath: 'com.capacitorjs.plugins.app.AppPlugin' },
]);

const GOOD_MAPPING = [
  'com.adapty.Adapty -> com.adapty.Adapty:',
  '    void a() -> a',
  `${PLUGIN} -> ${PLUGIN}:`,
  'com.example.plugin.BuildConfig -> a.a:',
].join('\n');

const analyze = (mapping, usage = '', pluginClasses = []) => analyzeR8({ mapping, usage, pluginClasses });

function captureIo() {
  const out = { log: [], error: [] };
  return {
    out,
    io: {
      log: (msg) => out.log.push(msg),
      error: (msg) => out.error.push(msg),
    },
  };
}

function writeFixtures(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-r8-keep-'));
  const paths = {};
  for (const [name, content] of Object.entries(files)) {
    paths[name] = path.join(dir, name);
    fs.writeFileSync(paths[name], content);
  }
  return paths;
}

const cliArgs = (p) => [
  `--mapping=${p['mapping.txt']}`,
  `--usage=${p['usage.txt']}`,
  `--plugins-json=${p['capacitor.plugins.json']}`,
];

describe('pluginClassesFromJson', () => {
  test('keeps only com.adapty classpaths', () => {
    expect(pluginClassesFromJson(PLUGINS_JSON)).toEqual([PLUGIN]);
  });
});

describe('analyzeR8', () => {
  test('passes when every Adapty class maps to itself', () => {
    const result = analyze(GOOD_MAPPING, '', [PLUGIN]);
    expect(result.kept).toBe(2);
    expect(result.renamed).toEqual([]);
    expect(result.missingPlugins).toEqual([]);
  });

  test('reports a class renamed inside com.adapty', () => {
    expect(analyze('com.adapty.internal.Foo -> com.adapty.a:').renamed).toEqual(['com.adapty.internal.Foo']);
  });

  test('reports a class moved out of com.adapty', () => {
    expect(analyze('com.adapty.Foo -> a.b:').renamed).toEqual(['com.adapty.Foo']);
  });

  test('ignores R8-synthesized classes', () => {
    const mapping = [
      'com.adapty.internal.crossplatform.ActivityProvider$Companion$$ExternalSyntheticLambda0 -> com.adapty.internal.crossplatform.a:',
      '# {"id":"sourceFile","fileName":"R8$$SyntheticClass"}',
      '# {"id":"com.android.tools.r8.synthesized"}',
      '    void <init>() -> <init>',
    ].join('\n');
    const result = analyze(mapping);
    expect(result.renamed).toEqual([]);
    expect(result.kept).toBe(0);
  });

  test('still reports a renamed class whose member is synthesized', () => {
    const mapping = [
      'com.adapty.Foo -> a.b:',
      '    void lambda$0() -> a',
      '    # {"id":"com.android.tools.r8.synthesized"}',
    ].join('\n');
    expect(analyze(mapping).renamed).toEqual(['com.adapty.Foo']);
  });

  test('does not treat com.adaptytest as Adapty', () => {
    const result = analyze('com.adaptytest.R -> a.c:');
    expect(result.kept).toBe(0);
    expect(result.renamed).toEqual([]);
  });

  test('reports removed classes and members from usage.txt', () => {
    const usage = 'com.adapty.Foo\ncom.adapty.Bar:\n    void x()\ncom.adapty.Bar:\n';
    expect(analyze(GOOD_MAPPING, usage).removed).toEqual(['com.adapty.Foo', 'com.adapty.Bar']);
  });

  test('ignores removed static initializers', () => {
    const usage =
      'com.adapty.ui.AdaptyFlowView:\n    static void <clinit>()\ncom.adapty.ui.AdaptyUI$Action:\n    static void <clinit>()\n';
    expect(analyze(GOOD_MAPPING, usage).removed).toEqual([]);
  });

  test('ignores members R8 removed from its own synthesized classes', () => {
    const usage = [
      'com.adapty.internal.di.Dependencies$init$2$$InternalSyntheticLambda$1$680148eb$0:',
      '    public final synthetic java.lang.String f$0',
      'com.adapty.Foo$$ExternalSyntheticLambda0:',
      '    public final synthetic java.lang.String f$0',
    ].join('\n');
    expect(analyze(GOOD_MAPPING, usage).removed).toEqual([]);
  });

  test('still reports a removed member next to a removed static initializer', () => {
    const usage = 'com.adapty.Bar:\n    static void <clinit>()\n    public void track()\n';
    expect(analyze(GOOD_MAPPING, usage).removed).toEqual(['com.adapty.Bar']);
  });

  test('ignores a whole R8-synthesized class removed', () => {
    expect(analyze(GOOD_MAPPING, 'com.adapty.Foo$$ExternalSyntheticLambda0\n').removed).toEqual([]);
  });

  test('reports a plugin class missing from the mapping', () => {
    const result = analyze('com.adapty.Adapty -> com.adapty.Adapty:', '', [PLUGIN]);
    expect(result.missingPlugins).toEqual([PLUGIN]);
  });

  test('counts billingclient classes', () => {
    const mapping = `${GOOD_MAPPING}\ncom.android.billingclient.api.BillingClient -> com.android.billingclient.api.BillingClient:`;
    expect(analyze(mapping).billing).toBe(1);
  });
});

describe('runCli', () => {
  test('fails when capacitor.plugins.json lists no Adapty plugin', () => {
    const p = writeFixtures({
      'mapping.txt': GOOD_MAPPING,
      'usage.txt': '',
      'capacitor.plugins.json': JSON.stringify([
        { pkg: '@capacitor/app', classpath: 'com.capacitorjs.plugins.app.AppPlugin' },
      ]),
    });
    const { out, io } = captureIo();
    expect(runCli(cliArgs(p), io)).toBe(1);
    expect(out.error.join('\n')).toContain('capacitor.plugins.json');
  });

  test('fails on zero kept classes (vacuous run)', () => {
    const p = writeFixtures({
      'mapping.txt': 'com.example.plugin.BuildConfig -> a.a:',
      'usage.txt': '',
      'capacitor.plugins.json': PLUGINS_JSON,
    });
    const { out, io } = captureIo();
    expect(runCli(cliArgs(p), io)).toBe(1);
    expect(out.error.join('\n')).toMatch(/FATAL/);
  });

  test('fails on a renamed class and lists it', () => {
    const p = writeFixtures({
      'mapping.txt': `${GOOD_MAPPING}\ncom.adapty.Foo -> a.b:`,
      'usage.txt': '',
      'capacitor.plugins.json': PLUGINS_JSON,
    });
    const { out, io } = captureIo();
    expect(runCli(cliArgs(p), io)).toBe(1);
    expect(out.error.join('\n')).toContain('com.adapty.Foo');
  });

  test('reports a missing mapping file as FATAL', () => {
    const p = writeFixtures({ 'usage.txt': '', 'capacitor.plugins.json': PLUGINS_JSON });
    const missing = path.join(path.dirname(p['usage.txt']), 'mapping.txt');
    const { out, io } = captureIo();
    expect(
      runCli(
        [`--mapping=${missing}`, `--usage=${p['usage.txt']}`, `--plugins-json=${p['capacitor.plugins.json']}`],
        io,
      ),
    ).toBe(1);
    expect(out.error.join('\n')).toContain(`FATAL: ${missing} not found`);
  });

  test('--plugins-only passes without mapping/usage', () => {
    const p = writeFixtures({ 'capacitor.plugins.json': PLUGINS_JSON });
    const { io } = captureIo();
    expect(runCli(['--plugins-only', `--plugins-json=${p['capacitor.plugins.json']}`], io)).toBe(0);
  });

  test('succeeds and prints the summary line', () => {
    const p = writeFixtures({ 'mapping.txt': GOOD_MAPPING, 'usage.txt': '', 'capacitor.plugins.json': PLUGINS_JSON });
    const { out, io } = captureIo();
    expect(runCli(cliArgs(p), io)).toBe(0);
    expect(out.log.join('\n')).toMatch(/com\.adapty\.\* kept: 2 \(renamed: 0, removed: 0\)/);
  });
});
