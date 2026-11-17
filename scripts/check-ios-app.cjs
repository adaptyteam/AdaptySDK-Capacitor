#!/usr/bin/env node
// Checks a Capacitor iOS app around its build: that `cap sync` registered the plugin (`sync`),
// that the built App.app defines the plugin class (`linked`), and which AdaptySDK-iOS the SPM
// graph resolved (`pin`).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// From @objc(AdaptyCapacitorPlugin) in ios/Sources/AdaptyCapacitorPlugin/AdaptyCapacitorPlugin.swift.
const PLUGIN_CLASS = 'AdaptyCapacitorPlugin';
const SPM_PRODUCT = '.product(name: "AdaptyCapacitor", package: "AdaptyCapacitor")';
const MACHO_MAGICS = new Set(['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe']);

function checkSync({ capConfigJson, spmManifest }) {
  const errors = [];
  const classes = JSON.parse(capConfigJson).packageClassList || [];
  if (!classes.includes(PLUGIN_CLASS)) {
    errors.push(`packageClassList lacks ${PLUGIN_CLASS} — Capacitor will never register the plugin.`);
  }
  if (spmManifest !== undefined && !spmManifest.includes(SPM_PRODUCT)) {
    errors.push('CapApp-SPM/Package.swift does not depend on the AdaptyCapacitor product.');
  }
  return errors;
}

function isMachO(head) {
  return head.length >= 4 && MACHO_MAGICS.has(head.subarray(0, 4).toString('hex'));
}

function readHead(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4);
    const bytes = fs.readSync(fd, head, 0, 4, 0);
    return head.subarray(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

function listMachO(appDir) {
  const found = [];
  for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
    const full = path.join(appDir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) found.push(...listMachO(full));
    else if (entry.isFile() && isMachO(readHead(full))) found.push(full);
  }
  return found;
}

function isObjcClassDefined(nmOutput, className) {
  const pattern = new RegExp(` [DdSs] _OBJC_CLASS_\\$_${className}$`);
  return nmOutput.split('\n').some((line) => pattern.test(line));
}

function resolvedPin(packageResolvedJson) {
  const pins = JSON.parse(packageResolvedJson).pins || [];
  const pin = pins.find((p) => /adaptysdk-ios/i.test(p.identity || ''));
  return pin ? pin.state : null;
}

const defaultDeps = {
  // nm on a Debug App.debug.dylib prints ~10 MB; the 1 MB default buffer fails with ENOBUFS.
  nm: (file) => execFileSync('nm', [file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }),
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (const arg of rest) {
    const match = /^--(app-dir|app|resolved)=(.+)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function runSync(appDir, io) {
  const configPath = path.join(appDir, 'App', 'capacitor.config.json');
  if (!fs.existsSync(configPath)) {
    io.error(`FATAL: ${configPath} not found — run cap sync first.`);
    return 1;
  }
  const manifestPath = path.join(appDir, 'CapApp-SPM', 'Package.swift');
  const spmManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : undefined;
  const errors = checkSync({ capConfigJson: fs.readFileSync(configPath, 'utf8'), spmManifest });
  if (errors.length > 0) {
    errors.forEach((e) => io.error(`FATAL: ${e}`));
    return 1;
  }
  io.log(`sync: ${PLUGIN_CLASS} registered${spmManifest !== undefined ? ', AdaptyCapacitor in CapApp-SPM' : ''}`);
  return 0;
}

function runLinked(app, io, deps) {
  if (!fs.existsSync(app)) {
    io.error(`FATAL: ${app} not found — the build produced no app bundle.`);
    return 1;
  }
  const binaries = listMachO(app);
  if (binaries.length === 0) {
    io.error(`FATAL: no Mach-O binaries inside ${app}.`);
    return 1;
  }
  io.log(`Scanned ${binaries.length} Mach-O binaries in ${app}`);
  for (const binary of binaries) {
    let output;
    try {
      output = deps.nm(binary);
    } catch (error) {
      io.error(`FATAL: nm failed on ${binary}: ${error.message}`);
      return 1;
    }
    if (isObjcClassDefined(output, PLUGIN_CLASS)) {
      io.log(`linked: ${PLUGIN_CLASS} defined in ${path.relative(app, binary)}`);
      return 0;
    }
  }
  io.error(`FATAL: no binary in ${app} defines ${PLUGIN_CLASS} — the plugin is not linked.`);
  return 1;
}

function runPin(resolved, io) {
  if (!fs.existsSync(resolved)) {
    io.error(`FATAL: ${resolved} not found — the build resolved no package graph here.`);
    return 1;
  }
  const state = resolvedPin(fs.readFileSync(resolved, 'utf8'));
  if (!state) {
    io.error('FATAL: AdaptySDK-iOS absent from Package.resolved — the plugin manifest was not in the graph.');
    return 1;
  }
  io.log(`AdaptySDK-iOS resolved: ${JSON.stringify(state)}`);
  return 0;
}

function runCli(argv, io = { log: console.log, error: console.error }, deps = defaultDeps) {
  const args = parseArgs(argv);
  const usage =
    'usage: check-ios-app.cjs sync --app-dir=<ios/App> | linked --app=<App.app> | pin --resolved=<Package.resolved>';
  if (args.command === 'sync' && args['app-dir']) return runSync(args['app-dir'], io);
  if (args.command === 'linked' && args.app) return runLinked(args.app, io, deps);
  if (args.command === 'pin' && args.resolved) return runPin(args.resolved, io);
  io.error(usage);
  return 2;
}

module.exports = { checkSync, isMachO, isObjcClassDefined, listMachO, resolvedPin, runCli };

if (require.main === module) {
  process.exit(runCli(process.argv.slice(2)));
}
