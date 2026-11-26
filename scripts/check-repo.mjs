#!/usr/bin/env node
// Repository consistency checks (`npm run check`), no dependencies:
//   1. .github/labels.tsv is well formed;
//   2. every label an issue form applies exists in .github/labels.tsv;
//   3. changelog fragments in changes/unreleased/ follow its README;
//   4. CHANGELOG.md keeps its [Unreleased] heading.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
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
for (const file of readdirSync(join(root, formDir)).filter((f) => /\.ya?ml$/.test(f) && f !== 'config.yml')) {
  const match = read(`${formDir}/${file}`).match(/^labels:\s*\[(.*)\]\s*$/m);
  for (const label of match ? match[1].split(',').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : []) {
    if (!labels.has(label.toLowerCase())) errors.push(`${formDir}/${file}: label "${label}" is not in .github/labels.tsv`);
  }
}

// 3. Fragments: section headings from the README, entries "- ", continuations indented by two spaces.
const sections = new Set([
  '### Breaking changes and upgrade', '### Added', '### Changed and fixed', '### Removed', '### Security',
]);
const fragDir = 'changes/unreleased';
for (const file of readdirSync(join(root, fragDir)).filter((f) => f !== 'README.md' && f !== '.gitkeep')) {
  const where = `${fragDir}/${file}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(file)) errors.push(`${where}: name must be lowercase letters, digits and hyphens, ending in .md`);
  let heading = false;
  let entries = 0;
  read(where).split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    if (line.startsWith('#')) {
      if (!sections.has(line.trimEnd())) errors.push(`${where}:${i + 1}: unknown heading "${line}" (see ${fragDir}/README.md)`);
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

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Repository checks passed.');
