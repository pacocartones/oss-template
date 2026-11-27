// scripts/check-repo.mjs, one case per rule it enforces, each on a small throwaway repository.
// The real repository is checked last, through the command line as `npm run check` runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { anchors, checkRepo } from './check-repo.mjs';

const SCRIPT = join(import.meta.dirname, 'check-repo.mjs');

/** The smallest repository that passes every check. */
const BASE = {
  '.github/labels.tsv': '# name\tcolor\tdescription\nbug\td73a4a\tSomething isn\'t working\n\ngood first issue\t7057ff\tGood for newcomers\n',
  '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug\nlabels: [bug]\nbody: []\n',
  '.github/ISSUE_TEMPLATE/config.yml':
    'contact_links:\n  - url: https://github.com/someone/repo/blob/main/CONTRIBUTING.md#your-first-contribution\n  - url: https://github.com/someone/repo/security/advisories/new\n',
  'changes/unreleased/README.md': '# Changelog fragments\n\nSee [RELEASING](../../RELEASING.md).\n',
  'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n',
  'CONTRIBUTING.md': '# Contributing\n\n## Your first contribution\n\nPick an [issue](../../issues?q=is%3Aopen) and read [below](#claiming-an-issue).\n\n## Claiming an issue\n',
  'RELEASING.md': '# Releasing\n',
  'README.md': '# Repo\n\n[Contributing](CONTRIBUTING.md#claiming-an-issue), [labels](.github/labels.tsv), [forms](.github/ISSUE_TEMPLATE/), [site](https://example.com/missing).\n',
};

/** Errors of checkRepo on BASE with `changes` applied (a null value deletes the file). */
function check(changes = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-repo-'));
  try {
    for (const [path, content] of Object.entries({ ...BASE, ...changes })) {
      if (content === null) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    return checkRepo(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Assert that `changes` produce exactly one error, matching `pattern`. */
function fails(changes, pattern) {
  const errors = check(changes);
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], pattern);
}

test('the base fixture passes', () => {
  assert.deepEqual(check(), []);
});

test('1. labels.tsv: three tab-separated fields per label', () => {
  // The bug label stays valid on line 1, so the issue form keeps its label.
  fails({ '.github/labels.tsv': 'bug\td73a4a\tx\ndocs\t0075ca\n' }, /labels\.tsv:2: expected 3 tab-separated fields, got 2/);
  fails({ '.github/labels.tsv': 'bug\td73a4a\tx\ndocs 0075ca Documentation\n' }, /expected 3 tab-separated fields, got 1/);
  fails({ '.github/labels.tsv': 'bug\td73a4a\tx\ndocs\t0075ca\tx\textra\n' }, /got 4/);
});

test('1. labels.tsv: a label has a name', () => {
  assert.match(check({ '.github/labels.tsv': ' \td73a4a\tNo name\nbug\td73a4a\tx\n' }).join('\n'), /labels\.tsv:1: empty label name/);
});

test('1. labels.tsv: the color is six hex digits without #', () => {
  for (const color of ['#d73a4a', 'd73a4', 'd73a4ag', 'red']) {
    fails({ '.github/labels.tsv': `bug\t${color}\tx\n` }, new RegExp(`color "${color}" is not six hex digits`));
  }
  assert.deepEqual(check({ '.github/labels.tsv': 'bug\tD73A4A\tx\n' }), []);
});

test('1. labels.tsv: names are unique, ignoring case', () => {
  fails({ '.github/labels.tsv': 'bug\td73a4a\tx\nBug\td73a4a\ty\n' }, /labels\.tsv:2: duplicate label "Bug"/);
});

test('1. labels.tsv: comments and blank lines are skipped', () => {
  assert.deepEqual(check({ '.github/labels.tsv': '# a comment\twith\ttabs\tand more\n\nbug\td73a4a\tx\n' }), []);
});

test('2. issue forms: every applied label is in labels.tsv, ignoring case and quotes', () => {
  fails({ '.github/ISSUE_TEMPLATE/bug.yml': 'labels: [bug, triage]\n' }, /bug\.yml: label "triage" is not in \.github\/labels\.tsv/);
  fails({ '.github/ISSUE_TEMPLATE/idea.yaml': 'labels: ["nope"]\n' }, /idea\.yaml: label "nope"/);
  assert.deepEqual(check({ '.github/ISSUE_TEMPLATE/bug.yml': 'labels: ["Bug", \'good first issue\']\n' }), []);
});

test('2. issue forms: a form without labels, config.yml and non-YAML files are not checked for labels', () => {
  assert.deepEqual(check({
    '.github/ISSUE_TEMPLATE/plain.yml': 'name: Plain\nbody: []\n',
    '.github/ISSUE_TEMPLATE/notes.txt': 'labels: [nope]\n',
  }), []);
  assert.deepEqual(check({ '.github/ISSUE_TEMPLATE/config.yml': 'labels: [nope]\n' }), []);
});

test('3. fragments: a well-formed fragment passes, continuation lines and several sections included', () => {
  assert.deepEqual(check({
    'changes/unreleased/fix-empty-input.md': '### Changed and fixed\n\n- An empty input file now gives\n  a clear error (#42).\n\n### Security\n\n- Pinned a dependency.\n',
    'changes/unreleased/.gitkeep': '',
  }), []);
});

test('3. fragments: the file name is lowercase letters, digits and hyphens, ending in .md', () => {
  for (const name of ['Fix.md', 'fix_input.md', 'fix-.md', 'fix.txt']) {
    fails({ [`changes/unreleased/${name}`]: '### Added\n\n- x\n' }, /name must be lowercase letters, digits and hyphens/);
  }
});

test('3. fragments: only the sections of the README', () => {
  fails({ 'changes/unreleased/x.md': '### Fixed\n\n- x\n' }, /x\.md:1: unknown heading "### Fixed"/);
  fails({ 'changes/unreleased/x.md': '## Added\n\n- x\n' }, /unknown heading "## Added"/);
});

test('3. fragments: no text before the first heading', () => {
  fails({ 'changes/unreleased/x.md': 'Intro\n### Added\n\n- x\n' }, /x\.md:1: text before the first section heading/);
});

test('3. fragments: entries start with "- " and continue with two spaces', () => {
  fails({ 'changes/unreleased/x.md': '### Added\n\n- x\n* y\n' }, /x\.md:4: entries start with "- "/);
  fails({ 'changes/unreleased/x.md': '### Added\n\n- x\n continued\n' }, /x\.md:4: entries start with "- "/);
});

test('3. fragments: a continuation needs an entry before it, and a fragment needs an entry', () => {
  const errors = check({ 'changes/unreleased/x.md': '### Added\n\n  orphan\n' });
  assert.deepEqual(errors, ['changes/unreleased/x.md:3: entries start with "- " and continue with two spaces of indentation', 'changes/unreleased/x.md: no entries']);
  fails({ 'changes/unreleased/x.md': '### Added\n' }, /x\.md: no entries/);
});

test('4. CHANGELOG.md keeps its "## [Unreleased]" heading', () => {
  fails({ 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n' }, /CHANGELOG\.md: missing the "## \[Unreleased\]" heading/);
});

test('5. links: a relative link to a missing file fails, with file and line', () => {
  fails({ 'README.md': '# Repo\n\nSee [policy](POLICY.md).\n' }, /^README\.md:3: links to POLICY\.md, which does not exist$/);
  fails({ 'docs/guide.md': '[up](../MISSING.md)\n' }, /docs\/guide\.md:1: links to MISSING\.md/);
});

test('5. links: links resolve from the linking file, directories and query strings included', () => {
  assert.deepEqual(check({ 'docs/guide.md': '[readme](../README.md) [forms](../.github/ISSUE_TEMPLATE) [q](../README.md?plain=1)\n' }), []);
});

test('5. links: a #fragment must match a heading, in the same file or another', () => {
  fails({ 'README.md': '# Repo\n\n[x](CONTRIBUTING.md#claiming)\n' }, /README\.md:3: CONTRIBUTING\.md has no heading for #claiming/);
  fails({ 'README.md': '# Repo\n\n[x](#nowhere)\n' }, /README\.md:3: README\.md has no heading for #nowhere/);
  fails({ 'README.md': '# Repo\n\n[x](RELEASING.md#releasing)\n[y](.github/labels.tsv#L2)\n' }, /links to #L2 in \.github\/labels\.tsv, which is not a Markdown file/);
});

test('5. links: leaving the repository is only allowed for its own GitHub pages from the root', () => {
  fails({ 'README.md': '# Repo\n\n[x](../other-repo/README.md)\n' }, /links to \.\.\/other-repo\/README\.md, outside the repository/);
  fails({ 'docs/guide.md': '[x](../../issues)\n' }, /outside the repository/);
  assert.deepEqual(check({ 'README.md': '# Repo\n\n[a](../../issues) [b](../../pulls?q=x) [c](../../security/advisories/new)\n' }), []);
});

test('5. links: other sites, mailto and links inside code are not checked here', () => {
  assert.deepEqual(check({
    'README.md': '# Repo\n\n[a](https://example.com/x.md) [m](mailto:a@example.com) `[b](MISSING.md)`\n\n```md\n[c](MISSING.md)\n```\n',
  }), []);
});

test('5. links: issue forms link to existing files and headings of this repository', () => {
  fails({ '.github/ISSUE_TEMPLATE/config.yml': 'contact_links:\n  - url: https://github.com/someone/repo/blob/main/CONTRIBUTING.md#first-steps\n' },
    /config\.yml:2: CONTRIBUTING\.md has no heading for #first-steps/);
  fails({ '.github/ISSUE_TEMPLATE/bug.yml': 'labels: [bug]\ndescription: Read https://github.com/someone/repo/blob/main/GONE.md first.\n' },
    /bug\.yml:2: links to GONE\.md, which does not exist/);
});

test('anchors follow GitHub: lowercase, punctuation dropped, spaces to hyphens, repeats numbered', () => {
  const a = anchors('# What\'s inside, and where each rule lives\n## `npm run check`\n## Notes\n## Notes\n### [Link](x) text\n```\n# not a heading\n```\n');
  assert.deepEqual([...a], ['whats-inside-and-where-each-rule-lives', 'npm-run-check', 'notes', 'notes-1', 'link-text']);
});

test('this repository passes, through the command line', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Repository checks passed\./);
});

test('the command line exits 1 and lists the errors when a check fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-repo-'));
  try {
    for (const [path, content] of Object.entries({ ...BASE, 'CHANGELOG.md': '# Changelog\n' })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /CHANGELOG\.md: missing the "## \[Unreleased\]" heading/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
