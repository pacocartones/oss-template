// What this repository takes from pacocartones/.github, read with git (no API calls):
//   1. each reusable workflow exists at the pinned SHA, accepts the inputs its caller passes,
//      and is named as scripts/bootstrap.sh's required check names say;
//   2. every link to pacocartones/.github in this repository's files resolves on its main
//      branch, #fragment included.
// It needs network access to github.com.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anchors } from './check-repo.mjs';

const ROOT = join(import.meta.dirname, '..');
const UPSTREAM = 'https://github.com/pacocartones/.github';
const WORKFLOWS = join(ROOT, '.github/workflows');
const callers = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))
  .map((file) => ({ file, text: readFileSync(join(WORKFLOWS, file), 'utf8') }))
  .filter((c) => c.text.includes('uses: pacocartones/.github/'));
const PIN = callers[0].text.match(/@([0-9a-f]{40})/)[1];

let dir;
const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** A file of pacocartones/.github at a revision, or null when it does not exist there. */
const show = (rev, path) => { try { return git('show', `${rev}:${path}`); } catch { return null; } };

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'upstream-'));
  git('init', '-q');
  try {
    git('fetch', '-q', '--depth', '1', UPSTREAM, PIN, '+refs/heads/main:refs/remotes/upstream/main');
  } catch (e) {
    throw new Error(`cannot fetch ${UPSTREAM} (${PIN} and main); this test needs github.com:\n${e.stderr}`);
  }
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('1. each pinned reusable workflow exists, takes its inputs, and matches the required check names', () => {
  const bootstrap = readFileSync(join(ROOT, 'scripts/bootstrap.sh'), 'utf8');
  // bootstrap.sh reads the CodeQL language from codeql.yml; fill it in the same way.
  const language = readFileSync(join(WORKFLOWS, 'codeql.yml'), 'utf8').match(/^ *language: *(\S+)/m)[1];
  const required = [...bootstrap.match(/^required_checks=\((.*)\)$/m)[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1].replace(/\$\{codeql_lang:-[^}]*\}/, language));
  for (const { file, text } of callers) {
    const [, id, path] = text.match(/^ {2}([\w-]+):\s*\n(?: {4}.*\n|\s*#.*\n)*? {4}uses: pacocartones\/\.github\/(\.github\/workflows\/[\w-]+\.yml)@/m);
    const upstream = show(PIN, path);
    assert.ok(upstream, `${file}: ${path} does not exist at ${PIN}`);
    assert.match(upstream, /\non:\n {2}workflow_call:/, `${path} is reusable`);

    // Inputs the caller passes exist upstream.
    const withBlock = text.match(/\n {4}with:\n((?: {6}.*\n?)*)/);
    const passed = Object.fromEntries([...(withBlock?.[1] ?? '').matchAll(/^ {6}([\w-]+): *(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
    for (const input of Object.keys(passed)) assert.match(upstream, new RegExp(`\\n {6}${input}:\\n`), `${path} has no input ${input}`);

    // The check name is "<caller job id> / <upstream job name>", with inputs filled in.
    const jobName = upstream.match(/\njobs:\n {2}[\w-]+:\n {4}name: (.+)\n/)[1]
      .replace(/\$\{\{ inputs\.([\w-]+) \}\}/g, (_, input) => passed[input] ?? upstream.match(new RegExp(`\\n {6}${input}:\\n(?: {8}.*\\n)*? {8}default: (.*)\\n`))[1].trim());
    assert.ok(required.includes(`${id} / ${jobName}`), `"${id} / ${jobName}" is not in bootstrap.sh's required_checks: ${JSON.stringify(required)}`);
  }
});

test('2. every link to pacocartones/.github resolves on its main branch', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(md|ya?ml|sh|mjs)$/.test(f) && !f.endsWith('.test.mjs'));
  let checked = 0;
  for (const file of files) {
    readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/https:\/\/github\.com\/pacocartones\/\.github(?:\/(?:blob|tree)\/main\/([^\s)#'"`>]+))?(?:#([\w-]+))?/g)) {
        const where = `${file}:${i + 1}`;
        const path = m[1] ?? 'README.md';
        const text = show('upstream/main', path);
        assert.ok(text !== null || git('ls-tree', 'upstream/main', path.replace(/\/$/, '')).trim(), `${where}: ${path} does not exist on pacocartones/.github main`);
        if (m[2]) assert.ok(anchors(text ?? '').has(m[2]), `${where}: ${path} on pacocartones/.github main has no heading for #${m[2]}`);
        checked += 1;
      }
    });
  }
  assert.ok(checked > 0, 'found the links');
});
