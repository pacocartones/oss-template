#!/usr/bin/env node
// Repository consistency checks (`npm run check`), no dependencies:
//   1. .github/labels.tsv is well formed;
//   2. every label an issue form applies exists in .github/labels.tsv;
//   3. changelog fragments in changes/unreleased/ follow its README;
//   4. CHANGELOG.md keeps its [Unreleased] heading;
//   5. every relative link in a Markdown file, and every link from an issue form to a file of
//      this repository, points to a file that exists and, with a #fragment, to a heading in it.
//      Links to other sites are not fetched here; scripts/upstream.test.mjs checks the ones to
//      pacocartones/.github.
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
const GITHUB_ROUTE = /^\.\.\/\.\.\/(issues|pulls|discussions|security|actions|releases|labels|wiki)([/?#]|$)/;

/** GitHub's heading anchors for a Markdown text: lowercase, punctuation dropped, spaces to hyphens, repeats numbered. */
export function anchors(markdown) {
  const seen = new Map();
  const out = new Set();
  for (const line of withoutCode(markdown, false)) {
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '');
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

  // 2. Issue forms: `labels: [a, b]` must name existing labels.
  const formDir = '.github/ISSUE_TEMPLATE';
  const forms = readdirSync(join(root, formDir)).filter((f) => /\.ya?ml$/.test(f));
  for (const file of forms.filter((f) => f !== 'config.yml')) {
    const match = read(`${formDir}/${file}`).match(/^labels:\s*\[(.*)\]\s*$/m);
    for (const label of match ? match[1].split(',').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : []) {
      if (!labels.has(label.toLowerCase())) errors.push(`${formDir}/${file}: label "${label}" is not in .github/labels.tsv`);
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

  // 5. Links within the repository.
  const anchorCache = new Map();
  /** Check one link target, relative to the root, from `where`; `fragment` without the #. */
  const checkTarget = (where, path, fragment) => {
    const abs = resolve(root, path);
    if (!existsSync(abs)) return errors.push(`${where}: links to ${path}, which does not exist`);
    if (!fragment) return;
    if (statSync(abs).isDirectory() || !abs.endsWith('.md')) return errors.push(`${where}: links to #${fragment} in ${path}, which is not a Markdown file`);
    if (!anchorCache.has(abs)) anchorCache.set(abs, anchors(readFileSync(abs, 'utf8')));
    if (!anchorCache.get(abs).has(decodeURIComponent(fragment))) errors.push(`${where}: ${path} has no heading for #${fragment}`);
  };
  for (const file of markdownFiles(root)) {
    withoutCode(read(file)).forEach((line, i) => {
      for (const [, target] of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
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
  for (const file of forms) {
    read(`${formDir}/${file}`).split('\n').forEach((line, i) => {
      const m = line.match(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:blob|tree)\/main\/([^\s#?'"]+)(?:#([^\s'"]+))?/);
      if (m) checkTarget(`${formDir}/${file}:${i + 1}`, posix.normalize(m[1]), m[2]);
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
