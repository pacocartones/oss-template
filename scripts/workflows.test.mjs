// The workflows in .github/workflows: the callers of pacocartones/.github pinned the same way,
// every other action pinned by full SHA, the rules of AGENTS.md, and the pr-description job's
// script, run as it is written there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '../.github/workflows');
const FILES = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();
const read = (file) => readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n');

const UPSTREAM_USES = /^\s+uses: pacocartones\/\.github\//;
const usesLines = (file) => read(file).split('\n').filter((l) => /^\s+(?:- )?uses: /.test(l));

test('every reusable workflow is pinned to one full SHA of pacocartones/.github, with branch and day', () => {
  const pins = new Set();
  for (const file of FILES) {
    for (const line of usesLines(file).filter((l) => UPSTREAM_USES.test(l))) {
      const m = line.match(/^\s+uses: pacocartones\/\.github\/\.github\/workflows\/[\w-]+\.yml@([0-9a-f]{40}) # main \d{4}-\d{2}-\d{2}$/);
      assert.ok(m, `${file}: ${line.trim()}`);
      pins.add(m[1]);
    }
  }
  assert.equal(pins.size, 1, `one SHA for all callers, found ${[...pins].join(', ')}`);
});

/** Whether a `uses:` line of a step names an action pinned to a full commit SHA, with its version as a comment. */
const pinnedAction = (line) => /^\s+(?:- )?uses: [\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40} +# v\d+(?:\.\d+){0,2}\s*$/.test(line);

test('the action pin rule: a full SHA and its version, not a tag, a branch or a short SHA', () => {
  assert.ok(pinnedAction('      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1'));
  assert.ok(pinnedAction('        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1'), 'two spaces before the comment, as in scorecard.yml');
  assert.ok(pinnedAction('        uses: github/codeql-action/upload-sarif@1bd86f2fdb4b86187fa4059f16f31a3202acc9ea  # v4.39.4'));
  for (const line of [
    '        uses: actions/checkout@v7',
    '        uses: actions/checkout@main # v7.0.1',
    '        uses: actions/checkout@3d3c42e # v7.0.1',
    '        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    '        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # latest',
    '        uses: docker://alpine:3',
  ]) assert.ok(!pinnedAction(line), line);
});

test('every other action is pinned to a full commit SHA, with its version as a comment', () => {
  let checked = 0;
  for (const file of FILES) {
    for (const line of usesLines(file).filter((l) => !UPSTREAM_USES.test(l))) {
      assert.ok(pinnedAction(line), `${file}: ${line.trim()}`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'scorecard.yml uses actions directly');
});

test('every workflow starts with no permissions and never runs on pull_request_target', () => {
  for (const file of FILES) {
    assert.match(read(file), /\npermissions: \{\}\n/, `${file}: top-level permissions: {}`);
    assert.doesNotMatch(read(file), /^\s*pull_request_target\s*:/m, `${file}: pull_request_target`);
  }
});

test('every checkout step keeps no credentials', () => {
  for (const file of FILES) {
    const lines = read(file).split('\n');
    lines.forEach((line, i) => {
      if (!/^\s+(?:- )?uses: actions\/checkout@/.test(line)) return;
      const indent = line.match(/^ */)[0].length + (line.trimStart().startsWith('- ') ? 2 : 0);
      const step = [];
      for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || lines[j].match(/^ */)[0].length > indent || (lines[j].match(/^ */)[0].length === indent && !lines[j].trimStart().startsWith('- '))); j++) step.push(lines[j]);
      assert.ok(step.some((l) => /^\s+persist-credentials: false\s*$/.test(l)), `${file}:${i + 1}: checkout without persist-credentials: false`);
    });
  }
});

test('scorecard.yml: analysis on main only, its permissions per job, the attribution header kept', () => {
  const text = read('scorecard.yml');
  assert.match(text, /^# Copied from ossf\/scorecard-action, examples\/scorecard\.yml at commit df56f2d/);
  assert.match(text, /Apache-2\.0/);
  assert.match(text, /\n'on':\n(?: {2}#.*\n)* {2}branch_protection_rule:\n(?: {2}#.*\n)* {2}schedule:\n/);
  assert.match(text, /\n {2}push:\n {4}branches: \['main'\]\n/);
  assert.doesNotMatch(text, /^ {2}pull_request/m, 'not on pull requests');
  assert.match(text, /\n {4}if: \$\{\{ github\.event\.repository\.default_branch == github\.ref_name \}\}\n/);
  assert.match(text, /\n {4}permissions:\n {6}security-events: write\b.*\n {6}id-token: write\b.*\n\n/);
});

test('commit policy runs again when a pull request description is edited', () => {
  assert.match(read('commit-policy.yml'), /\non:\n {2}pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, edited, synchronize, reopened\]\n/);
});

// The pr-description job of commit-policy.yml.
const JOB = read('commit-policy.yml').split(/\n(?= {2}[\w-]+:\s*$)/m).find((j) => /^ {2}pr-description:/.test(j));

function script() {
  const lines = JOB.split('\n');
  const at = lines.findIndex((l) => /^\s+run: \|\s*$/.test(l));
  const base = lines[at].match(/^ */)[0].length;
  const body = [];
  for (let i = at + 1; i < lines.length && (lines[i].trim() === '' || lines[i].match(/^ */)[0].length > base); i++) body.push(lines[i]);
  const cut = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return body.map((l) => l.slice(cut)).join('\n');
}

function describe(body) {
  const r = spawnSync('bash', ['-c', script()], { encoding: 'utf8', env: { ...process.env, PR_BODY: body } });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('the PR description job runs only for the maintainer, with no permissions, reading the body through env', () => {
  assert.ok(JOB, 'commit-policy.yml has a pr-description job');
  assert.match(JOB, /\n {4}name: PR description\n/);
  assert.match(JOB, /\n {4}if: \$\{\{ github\.event\.pull_request\.user\.login == 'pacocartones' \}\}\n/);
  assert.match(JOB, /\n {4}permissions: \{\}\n/);
  assert.match(JOB, /\n {10}PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}\n/);
  assert.doesNotMatch(script(), /\$\{\{/, 'no expression inside the script');
});

test('a plain description passes, empty included', () => {
  for (const body of ['## What changed and why\n\nAdds a check.', '', 'Docs generated by the build script.']) {
    const r = describe(body);
    assert.equal(r.code, 0, `${body}\n${r.out}`);
    assert.match(r.out, /pull request description: ok/);
  }
});

test('an AI footer or co-author line in the description fails', () => {
  for (const footer of [
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    'Generated with Claude Code',
    'generated by an AI assistant',
    'Generated by Copilot',
    'Co-Authored-By: Claude <noreply@anthropic.com>',
    'Co-authored-by: Codex <codex@openai.com>',
  ]) {
    const r = describe(`## What changed and why\n\nAdds a check.\n\n${footer}\n`);
    assert.equal(r.code, 1, `${footer}\n${r.out}`);
    assert.match(r.out, /AI footer in the pull request description/);
  }
});
