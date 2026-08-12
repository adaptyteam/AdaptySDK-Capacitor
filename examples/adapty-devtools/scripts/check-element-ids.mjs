// Validates src/elementIds.ts and regenerates docs/element-ids.md.
//
//   node --experimental-strip-types scripts/check-element-ids.mjs           validate + rewrite docs
//   node --experimental-strip-types scripts/check-element-ids.mjs --check   validate + fail if docs are stale
//
// Checks:
//   1. every registry leaf matches <area>-<name>-<kind>
//   2. no id is declared twice in the registry
//   3. every `<button` / `<input` / `<select` / `<textarea` in a .tsx file carries an `id=`
//   4. every `id=` attribute is `elementIds.<path>` (optionally called), or a pass-through
//      of an `id` the component actually received as a parameter — never a literal
//   5. no registry path is used on more than one element
//   6. every registry leaf is referenced as `elementIds.<path>` from some .tsx file,
//      outside of comments

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { elementIds } from '../src/elementIds.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const DOC_PATH = join(ROOT, 'docs', 'element-ids.md');
const checkOnly = process.argv.includes('--check');

const KINDS = ['btn', 'input', 'select', 'textarea', 'toggle', 'value', 'tab', 'item'];
const ID_PATTERN = new RegExp(`^[a-z0-9]+(?:-(?:[a-z0-9]+|\\{key\\}))*-(?:${KINDS.join('|')})$`);

// Interactive controls that must always be addressable from an automation script.
const CONTROL_TAG = /<(button|input|select|textarea)(?=[\s/>])/g;
// An `id` attribute, never a `data-*-id` / `aria-*-id` one — hence the lookbehind.
const ID_ATTRIBUTE = /(?<![-\w])id=/g;
// `id={elementIds.a.b}` or `id={elementIds.a.b(expr)}`.
const REGISTRY_EXPRESSION = /^elementIds\.([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*)\s*(?:\(|$)/;
// A pass-through: the component's own `id` prop, or the `id` field of a locally built descriptor.
const PASS_THROUGH_EXPRESSION = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.id)?$/;

const errors = [];

// --- source scanning helpers ------------------------------------------------

const lineAt = (source, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
};

// Replaces `//` and `/* */` comments with spaces, preserving every newline so that offsets and
// line numbers stay identical to the original source. String and template literals are left
// alone — the codebase has `https://…` URLs inside them.
const stripComments = (source) => {
  const out = [...source];
  // Stack of open brace-ish scopes; a '$' entry means "this `}` closes a `${…}`".
  const scopes = [];
  let quote = null;
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        i += 1;
        continue;
      }
      if (quote === '`' && ch === '$' && next === '{') {
        scopes.push('$');
        quote = null;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      let end = source.indexOf('*/', i + 2);
      end = end === -1 ? source.length : end + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      scopes.push('{');
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (scopes.pop() === '$') quote = '`';
      i += 1;
      continue;
    }
    i += 1;
  }
  return { text: out.join(''), unterminated: quote !== null };
};

// Scans forward from `start` (the index of a `<` or of a `{`) and returns the index of the
// character that closes it. JSX props are full of arrow functions, so `>` only ends an opening
// tag at brace depth 0; opening tags routinely span many lines, so this is offset-based rather
// than line-based. Quotes and template literals are skipped over.
const scanBalanced = (source, start, mode) => {
  const scopes = [];
  let quote = null;
  let i = mode === 'brace' ? start : start + 1;
  if (mode === 'brace') {
    scopes.push('{');
    i += 1;
  }
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      else if (quote === '`' && ch === '$' && next === '{') {
        scopes.push('$');
        quote = null;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      scopes.push('{');
      i += 1;
      continue;
    }
    if (ch === '}') {
      const popped = scopes.pop();
      if (popped === '$') quote = '`';
      if (mode === 'brace' && scopes.length === 0) return i;
      i += 1;
      continue;
    }
    if (mode === 'tag' && scopes.length === 0 && ch === '>') return i;
    i += 1;
  }
  return -1;
};

// --- pass-through resolution (AST) ------------------------------------------
//
// A bare-identifier `id={x}` / `id={x.id}` is only legitimate when `x` is an id the component
// *received*. Deciding that needs real scope resolution — a file-wide "does this file declare an
// `id` prop anywhere" test lets a fabricated local const ride along with an unrelated props type —
// so this one rule parses the (comment-stripped) source with the TypeScript parser and resolves the
// identifier from the usage site outwards. Offsets in the stripped text match the original, so line
// numbers reported elsewhere stay valid.
//
// Deliberately stricter than "the value came from outside", in ways a contributor may trip over:
//   * the value must arrive through a parameter binding whose *property* name is `id`
//     (`({ id })`, `({ id: rowId })`, `function LogLine(id)`). A prop named `elementId` is
//     rejected: every `id=` attribute is itself checked, so an id can only enter a component
//     through an attribute the checker has already validated — renaming the prop would open a
//     laundering path for hardcoded ids.
//   * `id={props.id}` (undestructured props) is rejected — destructure the `id` prop instead. The
//     member form is reserved for list callbacks, where the `id` fields of the iterated array
//     literal must all be `elementIds.<path>` references; that is what makes `t.id` in a
//     `tabs.map((t) => …)` legitimate, and it is checked, not assumed.
//   * an identifier imported from another module is rejected — provenance cannot be checked here.

const FUNCTION_LIKE_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

const parseTsx = (file, text) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, /* setParentNodes */ true, ts.ScriptKind.TSX);

const nodeAt = (root, pos) => {
  let node = root;
  for (;;) {
    const child = ts.forEachChild(node, (candidate) =>
      candidate.getStart(root) <= pos && pos < candidate.end ? candidate : undefined,
    );
    if (!child) return node;
    node = child;
  }
};

// Every local name a binding name introduces, paired with the property it reads (`null` when the
// binding is positional or nested, i.e. when no single property name can be attributed to it).
const bindingsOf = (nameNode, out = []) => {
  if (ts.isIdentifier(nameNode)) {
    out.push({ local: nameNode.text, property: nameNode.text });
  } else if (ts.isObjectBindingPattern(nameNode)) {
    for (const element of nameNode.elements) {
      const property = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : null;
      if (ts.isIdentifier(element.name)) {
        out.push({ local: element.name.text, property: property ?? element.name.text });
      } else {
        for (const nested of bindingsOf(element.name)) out.push({ local: nested.local, property: null });
      }
    }
  } else if (ts.isArrayBindingPattern(nameNode)) {
    for (const element of nameNode.elements) {
      if (ts.isOmittedExpression(element)) continue;
      for (const nested of bindingsOf(element.name)) out.push({ local: nested.local, property: null });
    }
  }
  return out;
};

// Names declared directly *by* this node (not by its descendants' scopes): variable statements and
// declarations of a block or module, loop initializers, catch bindings, imports.
const ownDeclarations = (node) => {
  const out = [];
  const addList = (declarationList) => {
    for (const declaration of declarationList.declarations) {
      for (const binding of bindingsOf(declaration.name)) out.push({ local: binding.local, node: declaration });
    }
  };
  if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node)) {
    const statements = ts.isCaseBlock(node) ? node.clauses.flatMap((clause) => clause.statements) : node.statements;
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) addList(statement.declarationList);
      else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
        if (statement.name) out.push({ local: statement.name.text, node: statement });
      } else if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        if (clause.name) out.push({ local: clause.name.text, node: statement, imported: true });
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            out.push({ local: clause.namedBindings.name.text, node: statement, imported: true });
          } else {
            for (const specifier of clause.namedBindings.elements) {
              out.push({ local: specifier.name.text, node: statement, imported: true });
            }
          }
        }
      }
    }
  } else if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
    const { initializer } = node;
    if (initializer && ts.isVariableDeclarationList(initializer)) addList(initializer);
  } else if (ts.isCatchClause(node) && node.variableDeclaration) {
    for (const binding of bindingsOf(node.variableDeclaration.name)) {
      out.push({ local: binding.local, node: node.variableDeclaration });
    }
  }
  return out;
};

// Walks scopes outwards from `from`, returning the nearest binding of `name`.
const resolveName = (from, name) => {
  for (let current = from; current; current = current.parent) {
    if (FUNCTION_LIKE_KINDS.has(current.kind)) {
      for (const [index, parameter] of current.parameters.entries()) {
        const binding = bindingsOf(parameter.name).find((candidate) => candidate.local === name);
        if (binding) return { kind: 'parameter', property: binding.property, parameter, index, fn: current };
      }
    }
    const local = ownDeclarations(current).find((candidate) => candidate.local === name);
    if (local) return { kind: local.imported ? 'imported' : 'local', node: local.node };
  }
  return { kind: 'unresolved' };
};

// `elementIds.<path>` / `elementIds.<path>(…)` written as an expression node.
const registryPathOf = (node, sourceFile) => {
  const text = node.getText(sourceFile).trim();
  const match = REGISTRY_EXPRESSION.exec(text);
  return match ? match[1] : null;
};

// The array literal a list callback iterates, if it can be resolved locally: either written inline
// (`[…].map(cb)`) or held by a local variable initialised with an array literal.
const iteratedArrayLiteral = (call) => {
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  const source = call.expression.expression;
  if (ts.isArrayLiteralExpression(source)) return source;
  if (!ts.isIdentifier(source)) return null;
  const resolved = resolveName(source, source.text);
  if (resolved.kind !== 'local' || !ts.isVariableDeclaration(resolved.node)) return null;
  const initializer = resolved.node.initializer;
  return initializer && ts.isArrayLiteralExpression(initializer) ? initializer : null;
};

// Every element of `array` must be an object literal whose `id` field is a registry reference.
const registryPathsOfDescriptors = (array, sourceFile) => {
  if (array.elements.length === 0) return null;
  const paths = [];
  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) return null;
    const property = element.properties.find(
      (candidate) =>
        ts.isPropertyAssignment(candidate) &&
        (ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) &&
        candidate.name.text === 'id',
    );
    if (!property) return null;
    const path = registryPathOf(property.initializer, sourceFile);
    if (!path) return null;
    paths.push(path);
  }
  return paths;
};

// Classifies a `PASS_THROUGH_EXPRESSION` at `pos`. Returns the registry paths it stands for
// (possibly none) or the reason it is not a legitimate pass-through.
const classifyPassThrough = (sourceFile, expression, pos) => {
  const [root, member] = expression.split('.');
  const node = nodeAt(sourceFile, pos);
  const resolved = resolveName(node, root);
  if (resolved.kind !== 'parameter') {
    const what = {
      local: 'is declared locally, not received as a parameter',
      imported: 'is imported, not received as a parameter',
      unresolved: 'is not in scope',
    }[resolved.kind];
    return { reason: `\`${root}\` ${what}` };
  }
  if (!member) {
    if (resolved.property !== 'id') {
      return { reason: `the \`${root}\` parameter does not bind an \`id\` property` };
    }
    return { paths: [] };
  }
  // Member form: only a list callback over locally declared descriptors, whose `id` fields are all
  // registry references. `props.id` and friends land here and are rejected on purpose.
  const call = resolved.fn.parent;
  if (!ts.isCallExpression(call) || !call.arguments.includes(resolved.fn) || resolved.index !== 0) {
    return { reason: `\`${root}\` is not the element parameter of a list callback` };
  }
  const array = iteratedArrayLiteral(call);
  if (!array) {
    return { reason: `the list \`${root}\` comes from is not an array literal declared in this file` };
  }
  const paths = registryPathsOfDescriptors(array, sourceFile);
  if (!paths) {
    return { reason: `not every \`id\` in the list \`${root}\` comes from is an elementIds reference` };
  }
  return { paths };
};

// --- 1. flatten the registry ------------------------------------------------

const leaves = [];

const walk = (node, path) => {
  for (const [key, value] of Object.entries(node)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (typeof value === 'string') {
      leaves.push({ path: nextPath, id: value, dynamic: false });
    } else if (typeof value === 'function') {
      leaves.push({ path: nextPath, id: value('{key}'), dynamic: true });
    } else if (value && typeof value === 'object') {
      walk(value, nextPath);
    } else {
      errors.push(`${nextPath}: unsupported registry value of type ${typeof value}`);
    }
  }
};

walk(elementIds, '');

if (leaves.length === 0) errors.push('elementIds is empty');

// --- 2. convention + registry uniqueness ------------------------------------

const byId = new Map();

for (const leaf of leaves) {
  if (!ID_PATTERN.test(leaf.id)) {
    errors.push(`${leaf.path}: id "${leaf.id}" does not match <area>-<name>-<${KINDS.join('|')}>`);
  }
  const previous = byId.get(leaf.id);
  if (previous) {
    errors.push(`duplicate id "${leaf.id}" declared by both ${previous} and ${leaf.path}`);
  } else {
    byId.set(leaf.id, leaf.path);
  }
}

// --- 3. read every .tsx source ---------------------------------------------

const collectTsx = async (dir) => {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectTsx(full)));
    else if (entry.name.endsWith('.tsx')) found.push(full);
  }
  return found;
};

// readdir order is filesystem-defined, so sort explicitly — the generated doc must be
// byte-identical across machines or `--check` would flap on an untouched tree.
const tsxFiles = (await collectTsx(SRC))
  .map((file) => relative(ROOT, file).split(sep).join('/'))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// Everything below reads the comment-stripped source: a registry entry mentioned only in a
// `// TODO` must not count as used, and a commented-out control must not be flagged.
const sources = new Map();
const asts = new Map();
for (const file of tsxFiles) {
  const raw = await readFile(join(ROOT, file), 'utf8');
  const { text, unterminated } = stripComments(raw);
  if (unterminated) {
    errors.push(`${file}: could not parse quoting while stripping comments — check for a stray quote`);
  }
  sources.set(file, text);
  asts.set(file, parseTsx(file, text));
}

// --- 4. every interactive control carries an id -----------------------------

for (const [file, source] of sources) {
  for (const match of source.matchAll(CONTROL_TAG)) {
    const start = match.index;
    const end = scanBalanced(source, start, 'tag');
    if (end === -1) {
      errors.push(`${file}:${lineAt(source, start)}: unterminated <${match[1]}> opening tag`);
      continue;
    }
    const tag = source.slice(start, end + 1);
    if (!new RegExp(ID_ATTRIBUTE.source).test(tag)) {
      errors.push(
        `${file}:${lineAt(source, start)}: <${match[1]}> has no id attribute — add one from src/elementIds.ts`,
      );
    }
  }
}

// --- 5. every id attribute is a registry reference or a pass-through --------

const usedPaths = new Map();

const recordUsage = (path, site) => {
  if (!usedPaths.has(path)) usedPaths.set(path, []);
  usedPaths.get(path).push(site);
};

for (const [file, source] of sources) {
  for (const match of source.matchAll(ID_ATTRIBUTE)) {
    const valueStart = match.index + match[0].length;
    const line = lineAt(source, match.index);
    const opener = source[valueStart];
    if (opener !== '{') {
      errors.push(`${file}:${line}: hardcoded id attribute — use elementIds from src/elementIds.ts`);
      continue;
    }
    const close = scanBalanced(source, valueStart, 'brace');
    if (close === -1) {
      errors.push(`${file}:${line}: unterminated id={…} expression`);
      continue;
    }
    const expression = source.slice(valueStart + 1, close).trim();
    const registry = REGISTRY_EXPRESSION.exec(expression);
    if (registry) {
      recordUsage(registry[1], `${file}:${line}`);
      continue;
    }
    if (PASS_THROUGH_EXPRESSION.test(expression)) {
      const inner = source.indexOf(expression, valueStart + 1);
      const verdict = classifyPassThrough(asts.get(file), expression, inner);
      if (verdict.paths) {
        for (const path of verdict.paths) recordUsage(path, `${file}:${line}`);
        continue;
      }
      errors.push(
        `${file}:${line}: id={${expression}} is not a pass-through — ${verdict.reason}; ` +
          'use elementIds from src/elementIds.ts',
      );
      continue;
    }
    errors.push(
      `${file}:${line}: unsupported id expression \`${expression}\` — use elementIds.<path>, ` +
        'optionally called with the list key',
    );
  }
}

// --- 6. one element per registry path ---------------------------------------

for (const [path, sites] of usedPaths) {
  if (sites.length > 1) {
    errors.push(
      `elementIds.${path} is used on ${sites.length} elements (${sites.join(', ')}) — ` +
        'a DOM id must identify exactly one element',
    );
  }
}

// --- 7. coverage -----------------------------------------------------------

const usages = new Map();

for (const leaf of leaves) {
  const needle = new RegExp(`elementIds\\.${leaf.path.replace(/\./g, '\\.')}(?![A-Za-z0-9_])`);
  const files = [...sources].filter(([, source]) => needle.test(source)).map(([file]) => file);
  if (files.length === 0) {
    errors.push(`${leaf.path}: id "${leaf.id}" is declared but never used in a .tsx file`);
  }
  usages.set(leaf.path, files);
}

// --- 8. generated docs -----------------------------------------------------

const areas = new Map();
for (const leaf of leaves) {
  const area = leaf.path.split('.')[0];
  if (!areas.has(area)) areas.set(area, []);
  areas.get(area).push(leaf);
}

// Registry insertion order is grouped by screen; the doc is a lookup table, so sort it.
const sortedAreas = [...areas.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const lines = [
  '<!-- Generated by scripts/check-element-ids.mjs — do not edit by hand. -->',
  '',
  '# Devtools element ids',
  '',
  'Stable DOM ids for driving this app from outside its WebView: an automation script attaches',
  'over the WebKit inspector protocol, evaluates JavaScript against the running page, and clicks',
  'controls or reads state by id. CSS-module class names are hashed per build and labels change',
  'with copy edits — these ids do not.',
  '',
  'Declared in [src/elementIds.ts](../src/elementIds.ts). `{key}` marks a dynamic segment —',
  'the list index for products, the log id for log rows.',
  '',
  '## Enumerating dynamic rows',
  '',
  'Log rows are keyed by `crypto.randomUUID()`, so their ids cannot be constructed ahead of time.',
  'Enumerate them instead:',
  '',
  '```js',
  'document.querySelectorAll(\'[id^="logs-"][id$="-item"]\');',
  '```',
  '',
  'Product rows are keyed by their index in the paywall product list. Each row also carries a',
  '`data-vendor-product-id` attribute (`src/screens/app/sections/FlowSection.tsx`) — the only way',
  'to map a vendor product id back to the index the rest of its ids are keyed by:',
  '',
  '```js',
  'document.querySelector(\'[data-vendor-product-id="my.product"]\').id; // flow-product-0-item',
  '```',
  '',
];

for (const area of sortedAreas) {
  lines.push(`## ${area}`, '', '| id | registry path | used in |', '| --- | --- | --- |');
  for (const leaf of areas.get(area)) {
    lines.push(`| \`${leaf.id}\` | \`elementIds.${leaf.path}\` | ${usages.get(leaf.path).join(', ') || '—'} |`);
  }
  lines.push('');
}

const doc = `${lines.join('\n')}`;

if (errors.length === 0) {
  const existing = await readFile(DOC_PATH, 'utf8').catch(() => null);
  if (existing !== doc) {
    if (checkOnly) {
      errors.push('docs/element-ids.md is out of date — run `yarn check-ids:write`');
    } else {
      await mkdir(dirname(DOC_PATH), { recursive: true });
      await writeFile(DOC_PATH, doc, 'utf8');
      console.log('docs/element-ids.md updated');
    }
  }
}

// --- report ---------------------------------------------------------------

if (errors.length > 0) {
  console.error(`element id check failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`element id check passed: ${leaves.length} ids across ${areas.size} areas, ${sources.size} .tsx files`);
