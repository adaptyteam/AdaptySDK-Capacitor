#!/usr/bin/env node
// Verifies R8 kept the Adapty classes in a minified Android release build.
// io.adapty:android-sdk ships `-keep class com.adapty.** { *; }`, so every Adapty class must map
// to itself; only classes R8 synthesizes (lambdas, API outlines) may be renamed.
'use strict';

const fs = require('fs');

const ADAPTY_PREFIX = 'com.adapty.';
const BILLING_PREFIX = 'com.android.billingclient.';
const SYNTHESIZED_MARKER = '"com.android.tools.r8.synthesized"';
const CLASS_LINE = /^(\S+) -> (\S+):$/;
const MAX_LISTED = 20;
const STATIC_INIT = /^\s+static void <clinit>\(\)$/;
const SYNTHETIC_NAME = /\$\$(External|Internal)Synthetic/;

function pluginClassesFromJson(json) {
  const entries = JSON.parse(json);
  return entries.map((entry) => entry.classpath).filter((cp) => typeof cp === 'string' && cp.startsWith(ADAPTY_PREFIX));
}

function parseClasses(mapping) {
  const classes = [];
  let current = null;
  let inHeader = false;
  for (const line of mapping.split('\n')) {
    const match = CLASS_LINE.exec(line);
    if (match) {
      current = { from: match[1], to: match[2], synthesized: false };
      classes.push(current);
      inHeader = true;
    } else if (line.startsWith('#')) {
      // Only comments directly under the class line describe the class itself.
      if (inHeader && current && line.includes(SYNTHESIZED_MARKER)) current.synthesized = true;
    } else {
      inHeader = false;
    }
  }
  return classes;
}

// usage.txt lists a wholly removed class as `Cls`, and removed members as `Cls:` + indented lines.
// With R8 optimization on, dropping trivial `<clinit>`s and R8's own synthesized classes is safe.
function removedAdaptyEntries(usage) {
  const removed = new Set();
  let current = null;
  for (const line of usage.split('\n')) {
    if (line.startsWith(' ')) {
      if (current && !STATIC_INIT.test(line)) removed.add(current);
      continue;
    }
    const name = line.replace(/:$/, '').trim();
    const relevant = name.startsWith(ADAPTY_PREFIX) && !SYNTHETIC_NAME.test(name);
    current = relevant && line.endsWith(':') ? name : null;
    if (relevant && !line.endsWith(':')) removed.add(name);
  }
  return [...removed];
}

function analyzeR8({ mapping, usage, pluginClasses }) {
  const classes = parseClasses(mapping);
  const adapty = classes.filter((c) => c.from.startsWith(ADAPTY_PREFIX) && !c.synthesized);
  const identity = new Set(adapty.filter((c) => c.from === c.to).map((c) => c.from));

  return {
    kept: adapty.length,
    renamed: adapty.filter((c) => c.from !== c.to).map((c) => c.from),
    removed: removedAdaptyEntries(usage),
    missingPlugins: pluginClasses.filter((cp) => !identity.has(cp)),
    billing: classes.filter((c) => c.from.startsWith(BILLING_PREFIX)).length,
  };
}

function parseArgs(argv) {
  const args = { pluginsOnly: false };
  for (const arg of argv) {
    if (arg === '--plugins-only') args.pluginsOnly = true;
    const match = /^--(mapping|usage|plugins-json)=(.+)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function listSome(items) {
  return items.slice(0, MAX_LISTED).join('\n');
}

function runCli(argv, io = { log: console.log, error: console.error }) {
  const args = parseArgs(argv);
  const required = args.pluginsOnly ? ['plugins-json'] : ['mapping', 'usage', 'plugins-json'];
  const contents = {};
  for (const key of required) {
    const file = args[key];
    if (!file) {
      io.error(`FATAL: --${key}=<path> is required.`);
      return 1;
    }
    if (!fs.existsSync(file)) {
      io.error(`FATAL: ${file} not found.`);
      return 1;
    }
    contents[key] = fs.readFileSync(file, 'utf8');
  }

  const pluginClasses = pluginClassesFromJson(contents['plugins-json']);
  if (pluginClasses.length === 0) {
    io.error(
      `FATAL: ${args['plugins-json']} (capacitor.plugins.json) lists no com.adapty.* plugin — cap sync did not register @adapty/capacitor.`,
    );
    return 1;
  }
  if (args.pluginsOnly) {
    io.log(`Adapty plugins registered: ${pluginClasses.join(', ')}`);
    return 0;
  }

  const result = analyzeR8({ mapping: contents.mapping, usage: contents.usage, pluginClasses });
  io.log(
    `com.adapty.* kept: ${result.kept} (renamed: ${result.renamed.length}, removed: ${result.removed.length}), ` +
      `plugins: ${pluginClasses.join(', ')}, billingclient: ${result.billing}`,
  );

  // Sentinel: without Adapty classes in the mapping the other checks are vacuous.
  if (result.kept === 0) {
    io.error('FATAL: no com.adapty.* classes in the R8 mapping — the SDK was not on the classpath.');
    return 1;
  }
  if (result.renamed.length > 0) {
    io.error(
      `FATAL: R8 renamed ${result.renamed.length} com.adapty.* classes — the keep rules did not reach it:\n${listSome(result.renamed)}`,
    );
    return 1;
  }
  if (result.removed.length > 0) {
    io.error(`FATAL: R8 stripped ${result.removed.length} com.adapty.* entries:\n${listSome(result.removed)}`);
    return 1;
  }
  if (result.missingPlugins.length > 0) {
    io.error(`FATAL: plugin classes missing from the R8 mapping: ${result.missingPlugins.join(', ')}`);
    return 1;
  }
  return 0;
}

module.exports = { analyzeR8, pluginClassesFromJson, runCli };

if (require.main === module) {
  process.exit(runCli(process.argv.slice(2)));
}
