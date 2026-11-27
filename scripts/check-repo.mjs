#!/usr/bin/env node
// Repository consistency checks (`npm run check`), no dependencies:
//   1. .github/labels.tsv is well formed;
//   2. issue forms: a repository normally has none and inherits those of pacocartones/.github;
//      any form of its own sets `type:` to an issue type of the account (Task, Bug, Feature,
//      Docs, Data) and applies only labels from .github/labels.tsv;
//   3. changelog fragments in changes/unreleased/ follow its README;
//   4. CHANGELOG.md keeps its [Unreleased] heading;
//   5. the files a repository keeps of its own exist: MAINTAINERS.md and LICENSE;
//   6. every relative link in a Markdown file, and every link from an issue form to a file of
//      this repository, points to a file that exists and, with a #fragment, to a heading in it.
//      A link to a file the repository inherits instead (CODE_OF_CONDUCT.md, ...) says where it
//      lives now. Links to other sites are not fetched here; scripts/upstream.test.mjs checks
//      the ones to pacocartones/.github.
// Usage: node scripts/check-repo.mjs [repository root, default: this checkout]
// scripts/check-repo.test.mjs has a case for every rule.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECTIONS = new Set([
  '### Breaking changes and upgrade', '### Added', '### Changed and fixed', '### Removed', '### Security',
]);
// Links that leave the repository on purpose: GitHub pages of the repository itself, written
// relative to a file in its root (`../../issues?q=...`).
const ISSUE_TYPES = new Set(['Task', 'Bug', 'Feature', 'Docs', 'Data']);
const REQUIRED_FILES = ['MAINTAINERS.md', 'LICENSE'];
const UPSTREAM = 'https://github.com/pacocartones/.github';
// Files that pacocartones/.github publishes for every repository without its own; the template
// ships none of them, so a relative link to one is a link to a removed file.
const INHERITED = new Map([
  ['CODE_OF_CONDUCT.md', `${UPSTREAM}/blob/main/CODE_OF_CONDUCT.md`],
  ['SUPPORT.md', `${UPSTREAM}/blob/main/SUPPORT.md`],
  ['.github/ISSUE_TEMPLATE', `${UPSTREAM}/tree/main/.github/ISSUE_TEMPLATE`],
]);
const GITHUB_ROUTE = /^\.\.\/\.\.\/(issues|pulls|discussions|security|actions|releases|labels|wiki)([/?#]|$)/;

/** GitHub's heading anchors for a Markdown text: lowercase, punctuation dropped, spaces to hyphens, repeats numbered. */
export function anchors(markdown) {
  const seen = new Map();
  const out = new Set();
  for (const line of withoutCode(markdown, false)) {
    const m = line.match(/^#{1,6}[ \t]/);
    if (!m) continue;
    let text = line.slice(m[0].length).trim();
    // A closing sequence of #s is not part of the heading (plain string work, no backtracking regex).
    let end = text.length;
    while (end > 0 && text[end - 1] === '#') end--;
    if (end < text.length && (end === 0 || text[end - 1] === ' ' || text[end - 1] === '\t')) text = text.slice(0, end).trim();
    // Link text stays and the target goes; anything else that is not a letter, digit, space, _ or - is dropped below.
    text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

/** The lines of a Markdown text outside fenced code blocks, with inline code removed unless `inline` is false. */
function withoutCode(markdown, inline = true) {
  let fence = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return ''; }
    if (fence) return '';
    return inline ? line.replace(/`[^`]*`/g, '') : line;
  });
}

/** Every Markdown file of the repository, as a path relative to its root with / separators. */
function markdownFiles(root, dir = '') {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const path = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name === '.git' || e.name === 'node_modules' ? [] : markdownFiles(root, path);
    return e.name.endsWith('.md') ? [path] : [];
  });
}

/** Run every check on the repository at `root`; returns the errors, empty when it passes. */
export function checkRepo(root) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const errors = [];

  // 1. Labels: name, six-digit hex color, description; unique names.
  const labels = new Set();
  read('.github/labels.tsv').split('\n').forEach((line, i) => {
    if (line.trim() === '' || line.startsWith('#')) return;
    const where = `.github/labels.tsv:${i + 1}`;
    const fields = line.split('\t');
    if (fields.length !== 3) return errors.push(`${where}: expected 3 tab-separated fields, got ${fields.length}`);
    const [name, color] = fields;
    if (!name.trim()) errors.push(`${where}: empty label name`);
    if (!/^[0-9a-fA-F]{6}$/.test(color)) errors.push(`${where}: color "${color}" is not six hex digits`);
    if (labels.has(name.toLowerCase())) errors.push(`${where}: duplicate label "${name}"`);
    labels.add(name.toLowerCase());
  });

  // 2. Issue forms of the repository's own, if any: a top-level `type:` naming an issue type, and
  // `labels: [a, b]` (or a block list) naming existing labels. config.yml is not a form.
  const formDir = '.github/ISSUE_TEMPLATE';
  const forms = existsSync(join(root, formDir)) ? readdirSync(join(root, formDir)).filter((f) => /\.ya?ml$/.test(f)) : [];
  const unquote = (v) => v.trim().replace(/^["']|["']$/g, '');
  for (const file of forms.filter((f) => f !== 'config.yml')) {
    const where = `${formDir}/${file}`;
    const text = read(where);
    const type = text.match(/^type:[ \t]*(.*?)[ \t]*(?:#.*)?$/m);
    if (!type || !unquote(type[1])) errors.push(`${where}: sets no type: (one of ${[...ISSUE_TYPES].join(', ')})`);
    else if (!ISSUE_TYPES.has(unquote(type[1]))) errors.push(`${where}: type "${unquote(type[1])}" is not one of ${[...ISSUE_TYPES].join(', ')}`);
    const flow = text.match(/^labels:[ \t]*\[(.*)\][ \t]*$/m);
    const block = text.match(/^labels:[ \t]*\n((?:[ \t]+-.*\n?)+)/m);
    const applied = flow ? flow[1].split(',') : block ? block[1].split('\n').map((l) => l.replace(/^\s*-/, '')) : [];
    for (const label of applied.map(unquote).filter(Boolean)) {
      if (!labels.has(label.toLowerCase())) errors.push(`${where}: label "${label}" is not in .github/labels.tsv`);
    }
  }

  // 3. Fragments: section headings from the README, entries "- ", continuations indented by two spaces.
  const fragDir = 'changes/unreleased';
  for (const file of readdirSync(join(root, fragDir)).filter((f) => f !== 'README.md' && f !== '.gitkeep')) {
    const where = `${fragDir}/${file}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(file)) errors.push(`${where}: name must be lowercase letters, digits and hyphens, ending in .md`);
    let heading = false;
    let entries = 0;
    read(where).split('\n').forEach((line, i) => {
      if (line.trim() === '') return;
      if (line.startsWith('#')) {
        if (!SECTIONS.has(line.trimEnd())) errors.push(`${where}:${i + 1}: unknown heading "${line}" (see ${fragDir}/README.md)`);
        heading = true;
      } else if (!heading) {
        errors.push(`${where}:${i + 1}: text before the first section heading`);
      } else if (line.startsWith('- ')) {
        entries += 1;
      } else if (!(line.startsWith('  ') && entries > 0)) {
        errors.push(`${where}:${i + 1}: entries start with "- " and continue with two spaces of indentation`);
      }
    });
    if (entries === 0) errors.push(`${where}: no entries`);
  }

  // 4. Changelog.
  if (!/^## \[Unreleased\]$/m.test(read('CHANGELOG.md'))) errors.push('CHANGELOG.md: missing the "## [Unreleased]" heading');

  // 5. Files of its own.
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push(`${file}: missing; every repository keeps its own`);

  // 6. Links within the repository.
  const anchorCache = new Map();
  /** Check one link target, relative to the root, from `where`; `fragment` without the #. */
  const checkTarget = (where, path, fragment) => {
    const abs = resolve(root, path);
    if (!existsSync(abs)) {
      const inherited = [...INHERITED].find(([p]) => path === p || path.startsWith(`${p}/`));
      return errors.push(`${where}: links to ${path}, which does not exist${inherited ? `; it is inherited from pacocartones/.github, link to ${inherited[1]}` : ''}`);
    }
    if (!fragment) return;
    if (statSync(abs).isDirectory() || !abs.endsWith('.md')) return errors.push(`${where}: links to #${fragment} in ${path}, which is not a Markdown file`);
    if (!anchorCache.has(abs)) anchorCache.set(abs, anchors(readFileSync(abs, 'utf8')));
    if (!anchorCache.get(abs).has(decodeURIComponent(fragment))) errors.push(`${where}: ${path} has no heading for #${fragment}`);
  };
  for (const file of markdownFiles(root)) {
    withoutCode(read(file)).forEach((line, i) => {
      for (const [, raw] of line.matchAll(/\]\(([^)]*)\)/g)) {
        const target = raw.trim().split(/\s/)[0].replace(/^<|>$/g, ''); // drops an optional "title" and <...>
        if (!target) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // https:, mailto:, ...
        const where = `${file}:${i + 1}`;
        const [pathPart, fragment = ''] = target.split('#');
        const path = pathPart.split('?')[0];
        if (path === '') { checkTarget(where, file, fragment); continue; }
        const rel = relative(root, resolve(root, dirname(file), decodeURIComponent(path))).split(sep).join('/');
        if (rel.startsWith('..')) {
          if (!GITHUB_ROUTE.test(rel)) errors.push(`${where}: links to ${target}, outside the repository`);
          continue;
        }
        checkTarget(where, rel, fragment);
      }
    });
  }
  // Issue forms link to files of this repository by URL: https://github.com/<owner>/<repo>/blob/main/<path>.
  // Links to pacocartones/.github (as in the forms copied from it) are files of that repository.
  for (const file of forms) {
    read(`${formDir}/${file}`).split('\n').forEach((line, i) => {
      const m = line.match(/https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/(?:blob|tree)\/main\/([^\s#?'"]+)(?:#([^\s'"]+))?/);
      if (m && m[1].toLowerCase() !== 'pacocartones/.github') checkTarget(`${formDir}/${file}:${i + 1}`, posix.normalize(m[2]), m[3]);
    });
  }

  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = checkRepo(resolve(process.argv[2] ?? join(import.meta.dirname, '..')));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('Repository checks passed.');
}
