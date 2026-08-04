// Test runner for the webview-driver CLI.
//
// `node --test` on a glob that matches nothing reports "pass 0" and exits 0, so a bare
// `node --test 'scripts/webview-driver/__tests__/*.test.mjs'` can succeed having run no
// tests at all — a rename or a moved directory would silently drop the whole suite without
// anyone noticing. This wrapper resolves the files itself, fails when there are none, and
// hands the explicit list to `node --test`.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = fileURLToPath(new URL('./__tests__/', import.meta.url));

const files = (await readdir(testsDir))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join(testsDir, name));

if (files.length === 0) {
  process.stderr.write(`No *.test.mjs files found in ${testsDir}\n`);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
