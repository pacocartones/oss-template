// scripts/bootstrap.sh against a simulated fresh copy of this repository: the tree is copied to
// a temporary directory and `gh` is scripts/fixtures/fake-gh.mjs, which answers from a state
// file as a brand-new GitHub repository would (GitHub's default labels, no rulesets). Nothing
// reaches GitHub: `git ls-remote` is faked too, a fetch of pacocartones/.github reads a local
// stand-in repository instead, and every other git call stays local.
// It checks that the dry run writes nothing and plans every label, ruleset and setting; that a
// real run reaches the planned state; and that runs after it change nothing (idempotent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..');
const TEMPLATE = 'pacocartones/oss-template';
const NEW = 'pacocartones/new-project';
const UPSTREAM_MAIN = 'f'.repeat(40);
const UPSTREAM_URL = 'https://github.com/pacocartones/.github';
/** The issue forms of the stand-in for pacocartones/.github main. */
const UPSTREAM_FORMS = {
  '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug report\ndescription: Something does not work.\ntype: Bug\nbody: []\n',
  '.github/ISSUE_TEMPLATE/config.yml': 'blank_issues_enabled: false\ncontact_links:\n  - name: Questions\n    url: https://github.com/pacocartones/.github/blob/main/SUPPORT.md\n    about: Ask here.\n',
};
const GITHUB_DEFAULT_LABELS = [
  ['bug', 'd73a4a', "Something isn't working"],
  ['documentation', '0075ca', 'Improvements or additions to documentation'],
  ['duplicate', 'cfd3d7', 'This issue or pull request already exists'],
  ['enhancement', 'a2eeef', 'New feature or request'],
  ['good first issue', '7057ff', 'Good for newcomers'],
  ['help wanted', '008672', 'Extra attention is needed'],
  ['invalid', 'e4e669', "This doesn't seem right"],
  ['question', 'd876e3', 'Further information is requested'],
  ['wontfix', 'ffffff', 'This will not be worked on'],
].map(([name, color, description]) => ({ name, color, description }));

/** The label standard, as bootstrap.sh reads it. */
const STANDARD = readFileSync(join(ROOT, '.github/labels.tsv'), 'utf8').split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => { const [name, color, description] = l.split('\t'); return { name, color, description }; });

/** A fresh copy of the repository, a fake gh and git on PATH, and a state file for gh. */
function sandbox(state = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-'));
  const repo = join(dir, 'repo');
  cpSync(ROOT, repo, { recursive: true, filter: (src) => !/[/\\](\.git|node_modules)$/.test(src) });
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const realGit = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash\nexec "${process.execPath}" "${join(ROOT, 'scripts/fixtures/fake-gh.mjs')}" "$@"\n`);
  // The stand-in for pacocartones/.github: a local repository whose main has UPSTREAM_FORMS.
  const upstream = join(dir, 'upstream');
  for (const [path, content] of Object.entries(UPSTREAM_FORMS)) {
    mkdirSync(join(upstream, path, '..'), { recursive: true });
    writeFileSync(join(upstream, path), content);
  }
  const git = (...args) => execFileSync(realGit, ['-C', upstream, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'forms');
  writeFileSync(join(bin, 'git'), [
    '#!/usr/bin/env bash',
    `if [ "$1" = ls-remote ]; then printf '%s\\trefs/heads/main\\n' "${state.upstreamMain ?? UPSTREAM_MAIN}"; exit 0; fi`,
    `args=(); for a in "$@"; do [ "$a" = "${UPSTREAM_URL}" ] && a="${upstream}"; args+=("$a"); done`,
    `exec "${realGit}" "\${args[@]}"`,
    '',
  ].join('\n'));
  chmodSync(join(bin, 'gh'), 0o755);
  chmodSync(join(bin, 'git'), 0o755);
  const statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ repo: NEW, labels: structuredClone(GITHUB_DEFAULT_LABELS), used: {}, rulesets: [], ...state }));
  const logPath = join(dir, 'gh.log');
  return {
    repo,
    run(...args) {
      writeFileSync(logPath, '');
      const r = spawnSync('bash', [join(repo, 'scripts/bootstrap.sh'), ...args], {
        cwd: repo, encoding: 'utf8', input: '',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_STATE: statePath, FAKE_GH_LOG: logPath },
      });
      const calls = readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
      return { code: r.status, out: r.stdout + r.stderr, calls, writes: calls.filter((c) => c.write) };
    },
    state: () => JSON.parse(readFileSync(statePath, 'utf8')),
    tree: () => hashTree(repo),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function hashTree(dir, prefix = '') {
  return Object.fromEntries(readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) return Object.entries(hashTree(dir, path));
    return [[path, createHash('sha256').update(readFileSync(join(dir, path))).digest('hex')]];
  }));
}

/** The required check names the workflows produce: "<job id> / <reusable job>" or the job's own name. */
function workflowChecks() {
  const dir = join(ROOT, '.github/workflows');
  const out = [];
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const text = readFileSync(join(dir, file), 'utf8');
    if (!/^on:\n(?: .*\n|#.*\n|\n)*? {2}pull_request:/m.test(text)) continue;
    // ai-footer.yml cleans text after it is posted and is never a gate, so it is not a required check.
    if (text.includes('/ai-footer-strip.yml@')) continue;
    const jobs = text.slice(text.search(/^jobs:/m)).split(/\n(?= {2}[\w-]+:\s*$)/m).slice(1);
    for (const job of jobs) {
      const id = job.match(/^ {2}([\w-]+):/)[1];
      if (/^ {4}uses: /m.test(job)) out.push({ file, prefix: `${id} / ` });
      else out.push({ file, exact: job.match(/^ {4}name: (.+)$/m)?.[1] ?? id });
    }
  }
  return out;
}

const containsTemplateName = (repo, file) => {
  try {
    return readFileSync(join(repo, file), 'utf8').includes('"name": "oss-template"');
  } catch { return false; }
};
const PACKAGE_FILES = ['package.json', 'package-lock.json'];

test('the dry run on a fresh copy writes nothing and plans every label, ruleset and setting', () => {
  const box = sandbox();
  try {
    const before = box.tree();
    const r = box.run('--dry-run', '--repo', NEW);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(r.writes, [], 'no write call to gh');
    assert.deepEqual(box.tree(), before, 'no file changed');
    assert.match(r.out, /Repository: pacocartones\/new-project \(dry run: nothing changes\)/);

    // 1. Template name: every file that still carries it is planned for a rewrite. No forms of
    // its own, so the repository inherits those of pacocartones/.github.
    for (const file of PACKAGE_FILES) {
      const planned = r.out.includes(`plan  rewrite the template name in ${file}`);
      assert.equal(planned, containsTemplateName(box.repo, file), `${file}\n${r.out}`);
    }
    assert.ok(containsTemplateName(box.repo, 'package.json'), 'the fixture has a name to rewrite');
    assert.match(r.out, /ok    no forms of its own: GitHub shows those of pacocartones\/\.github \(rerun with --own-forms/);
    assert.doesNotMatch(r.out, /config\.yml/);

    // 2. Labels: each label of the standard is either already right or planned, and nothing else.
    for (const label of STANDARD) {
      const have = GITHUB_DEFAULT_LABELS.find((l) => l.name.toLowerCase() === label.name.toLowerCase());
      const same = have && have.name === label.name && have.color === label.color.toLowerCase() && have.description === label.description;
      const line = same ? `ok    ${label.name}\n` : `plan  ${have ? 'update' : 'create'} label '${label.name}'\n`;
      assert.ok(r.out.includes(line), `${line}\n${r.out}`);
    }
    for (const extra of GITHUB_DEFAULT_LABELS.filter((l) => !STANDARD.some((s) => s.name.toLowerCase() === l.name.toLowerCase()))) {
      assert.ok(r.out.includes(`extra '${extra.name}' is outside the standard and unused`), `${extra.name}\n${r.out}`);
    }

    // 3. Rulesets, 4. security features, 5. manual steps.
    assert.match(r.out, /plan  create ruleset 'main integrity'\n/);
    assert.match(r.out, /plan  create ruleset 'main merge gate'\n/);
    for (const feature of ['private vulnerability reporting', 'secret scanning', 'secret scanning push protection', 'Dependabot alerts', 'Dependabot security updates']) {
      assert.match(r.out, new RegExp(`plan  enable ${feature}`));
    }
    assert.match(r.out, /== 5\. Remaining manual steps\n(?:.*\n)*?1\. /);
    assert.match(r.out, /Dry run: nothing changed\.\n$/);
  } finally {
    box.cleanup();
  }
});

test('a real run reaches the planned state, and every run after it changes nothing', () => {
  const box = sandbox();
  try {
    const first = box.run('--repo', NEW);
    assert.equal(first.code, 0, first.out);
    assert.doesNotMatch(first.out, /WARN|failed/);

    // Files: the template name is gone, the new one is in; no forms are created.
    for (const file of PACKAGE_FILES) assert.ok(!containsTemplateName(box.repo, file), `${file} still names the template`);
    assert.ok(!existsSync(join(box.repo, '.github/ISSUE_TEMPLATE')), 'no forms of its own: they are inherited');
    assert.equal(JSON.parse(readFileSync(join(box.repo, 'package.json'), 'utf8')).name, 'new-project');
    assert.deepEqual(readdirSync(box.repo, { recursive: true }).filter((f) => f.endsWith('.bak')), []);

    // Labels: the standard exactly, GitHub's other defaults kept (no --prune-labels).
    const state = box.state();
    for (const label of STANDARD) {
      const have = state.labels.find((l) => l.name === label.name);
      assert.deepEqual(have && { ...have, color: have.color.toLowerCase() }, { ...label, color: label.color.toLowerCase() });
    }
    assert.equal(state.labels.length, new Set([...STANDARD, ...GITHUB_DEFAULT_LABELS].map((l) => l.name.toLowerCase())).size);

    // Rulesets: sent with their bodies, as described in the README.
    const integrity = state.rulesets.find((r) => r.name === 'main integrity');
    const gate = state.rulesets.find((r) => r.name === 'main merge gate');
    assert.equal(state.rulesets.length, 2);
    assert.deepEqual(integrity.bypass_actors, []);
    assert.deepEqual(integrity.rules.map((r) => r.type).sort(), ['deletion', 'non_fast_forward']);
    for (const r of [integrity, gate]) {
      assert.equal(r.enforcement, 'active');
      assert.deepEqual(r.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
    }
    assert.deepEqual(gate.bypass_actors, []);
    const pr = gate.rules.find((r) => r.type === 'pull_request').parameters;
    assert.equal(pr.required_review_thread_resolution, true);
    const status = gate.rules.find((r) => r.type === 'required_status_checks').parameters;
    assert.equal(status.strict_required_status_checks_policy, false, 'branches need not be up to date (CONTRIBUTING.md, merge one at a time)');

    // Required checks: one per pull request job of .github/workflows, and nothing more.
    const required = status.required_status_checks.map((c) => c.context);
    const jobs = workflowChecks();
    assert.equal(required.length, jobs.length, `required ${JSON.stringify(required)} for jobs ${JSON.stringify(jobs)}`);
    for (const job of jobs) {
      const matching = required.filter((c) => (job.exact ? c === job.exact : c.startsWith(job.prefix)));
      assert.equal(matching.length, 1, `${JSON.stringify(job)} in ${JSON.stringify(required)}`);
    }
    const language = readFileSync(join(ROOT, '.github/workflows/codeql.yml'), 'utf8').match(/^ *language: *(\S+)/m)[1];
    assert.ok(required.includes(`codeql / Analyze (${language})`), JSON.stringify(required));
    assert.equal(Object.keys(state.security).length, 5);

    // Idempotent: a dry run plans no change, and a real run leaves files and state as they were.
    const tree = box.tree();
    const dry = box.run('--dry-run', '--repo', NEW);
    assert.equal(dry.code, 0, dry.out);
    assert.deepEqual(dry.writes, []);
    assert.match(dry.out, /ok    already rewritten/);
    assert.doesNotMatch(dry.out, /plan  (rewrite|create|update label)/);
    for (const label of STANDARD) assert.ok(dry.out.includes(`ok    ${label.name}\n`), label.name);
    assert.match(dry.out, /plan  update ruleset 'main integrity' \(id \d+\)/);

    const again = box.run('--repo', NEW);
    assert.equal(again.code, 0, again.out);
    assert.deepEqual(again.writes.filter((w) => w.args[0] === 'label'), [], 'no label write');
    assert.deepEqual(box.tree(), tree);
    assert.deepEqual(box.state().labels, state.labels);
    assert.deepEqual(box.state().rulesets, state.rulesets, 'the rulesets are rewritten with the same bodies');
  } finally {
    box.cleanup();
  }
});

test('--own-forms copies the forms of pacocartones/.github main once, and leaves the repository\'s own alone', () => {
  const box = sandbox();
  try {
    const before = box.tree();
    const dry = box.run('--dry-run', '--repo', NEW, '--own-forms');
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /plan  copy the issue forms of pacocartones\/\.github main into \.github\/ISSUE_TEMPLATE\//);
    assert.deepEqual(box.tree(), before, 'the dry run copies nothing');

    const r = box.run('--repo', NEW, '--own-forms');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /done  copy the issue forms/);
    assert.match(r.out, /Commit \.github\/ISSUE_TEMPLATE\/ in a pull request/);
    for (const [path, content] of Object.entries(UPSTREAM_FORMS)) {
      assert.equal(readFileSync(join(box.repo, path), 'utf8'), content, `${path} is copied unchanged`);
    }
    const copied = box.tree();
    assert.deepEqual(Object.keys(copied).filter((f) => !(f in before)).sort(), Object.keys(UPSTREAM_FORMS).sort(), 'only the forms are added');

    // Once the repository has forms of its own, a rerun keeps them as they are.
    writeFileSync(join(box.repo, '.github/ISSUE_TEMPLATE/bug.yml'), 'name: Ours\ntype: Bug\nbody: []\n');
    const edited = box.tree();
    const again = box.run('--repo', NEW, '--own-forms');
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /ok    \.github\/ISSUE_TEMPLATE\/ is the repository's own/);
    assert.deepEqual(box.tree(), edited);
  } finally {
    box.cleanup();
  }
});

test('--own-forms that cannot reach pacocartones/.github fails and leaves no partial copy', () => {
  const box = sandbox();
  try {
    rmSync(join(box.repo, '..', 'upstream'), { recursive: true, force: true });
    const r = box.run('--repo', NEW, '--own-forms');
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /WARN  failed: copy the issue forms/);
    assert.ok(!existsSync(join(box.repo, '.github/ISSUE_TEMPLATE')), 'nothing copied');
    assert.doesNotMatch(r.out, /Commit \.github\/ISSUE_TEMPLATE\//);
  } finally {
    box.cleanup();
  }
});

test('--prune-labels deletes only unused labels outside the standard', () => {
  const box = sandbox({ used: { question: [7, 9] } });
  try {
    const r = box.run('--repo', NEW, '--prune-labels');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /keep  'question' is outside the standard and on #7 #9/);
    const names = box.state().labels.map((l) => l.name).sort();
    assert.deepEqual(names, [...STANDARD.map((l) => l.name), 'question'].sort());
  } finally {
    box.cleanup();
  }
});

test('--bot-app-id lets the App bypass the merge gate only', () => {
  const box = sandbox();
  try {
    const r = box.run('--repo', NEW, '--bot-app-id', '12345');
    assert.equal(r.code, 0, r.out);
    const rulesets = box.state().rulesets;
    assert.deepEqual(rulesets.find((x) => x.name === 'main merge gate').bypass_actors, [{ actor_id: 12345, actor_type: 'Integration', bypass_mode: 'always' }]);
    assert.deepEqual(rulesets.find((x) => x.name === 'main integrity').bypass_actors, []);
  } finally {
    box.cleanup();
  }
});

test('on the template itself, the template name is left alone', () => {
  const box = sandbox({ repo: TEMPLATE });
  try {
    const before = box.tree();
    const r = box.run('--repo', TEMPLATE);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /skip  this is the template itself/);
    assert.deepEqual(box.tree(), before);
  } finally {
    box.cleanup();
  }
});

test('the pin is reported against pacocartones/.github main', () => {
  const pinned = readFileSync(join(ROOT, '.github/workflows/verify.yml'), 'utf8').match(/@([0-9a-f]{40})/)[1];
  for (const [main, expected] of [[pinned, /ok    the reusable workflows are pinned to pacocartones\/\.github main/], [UPSTREAM_MAIN, /pinned to [0-9a-f]{40} and pacocartones\/\.github main is f{40}; move the pin/]]) {
    const box = sandbox({ upstreamMain: main });
    try {
      assert.match(box.run('--dry-run', '--repo', NEW).out, expected);
    } finally {
      box.cleanup();
    }
  }
});

test('usage errors exit 2 before any call to gh', () => {
  const box = sandbox();
  try {
    for (const args of [['--nope'], ['--repo', 'not a repo'], ['--repo', NEW, '--bot-app-id', 'abc'], ['--own-forms=yes']]) {
      const r = box.run(...args);
      assert.equal(r.code, 2, `${args.join(' ')}\n${r.out}`);
      assert.deepEqual(r.calls, []);
    }
  } finally {
    box.cleanup();
  }
});
