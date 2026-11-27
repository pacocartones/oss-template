#!/usr/bin/env node
// A stand-in for the `gh` CLI that scripts/bootstrap.test.mjs puts first on PATH: it answers
// the calls scripts/bootstrap.sh makes from a JSON state file, never from GitHub.
//   FAKE_GH_STATE  the state: { repo, labels: [{name, color, description}], used: {label: [numbers]},
//                  rulesets: [{id, name, ...body}], security: {endpoint: method}, nextId }
//   FAKE_GH_LOG    every call is appended as one JSON line: { args, write, input }
// A write applies to the state, so a second run sees the result of the first.
// Unknown calls exit 3, so a new gh call in bootstrap.sh must be taught here first.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const statePath = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const input = args.includes('--input') ? readFileSync(0, 'utf8') : '';
const method = opt('-X') ?? 'GET';
const write = (args[0] === 'label' && (args[1] === 'create' || args[1] === 'delete')) || (args[0] === 'api' && method !== 'GET');
appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ args, write, input })}\n`);

const out = (value) => process.stdout.write(typeof value === 'string' ? value : `${JSON.stringify(value)}\n`);
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const fail = (message, code = 1) => { process.stderr.write(`fake gh: ${message}\n`); process.exit(code); };
const lower = (s) => s.toLowerCase();

if (args[0] === 'repo' && args[1] === 'view') {
  out(`${state.repo}\n`);
} else if (args[0] === 'label' && args[1] === 'list') {
  out(state.labels);
} else if (args[0] === 'label' && args[1] === 'create') {
  if (!args.includes('--force')) fail('label create without --force');
  const label = { name: args[2], color: opt('--color'), description: opt('--description') };
  const i = state.labels.findIndex((l) => lower(l.name) === lower(label.name));
  if (i < 0) state.labels.push(label); else state.labels[i] = label;
  save();
} else if (args[0] === 'label' && args[1] === 'delete') {
  state.labels = state.labels.filter((l) => l.name !== args[2]);
  save();
} else if (args[0] === 'search' && args[1] === 'issues') {
  // bootstrap.sh asks gh to join the numbers as "#1 #2" with --jq.
  out(`${(state.used?.[opt('--label')] ?? []).map((n) => `#${n}`).join(' ')}\n`);
} else if (args[0] === 'api') {
  const endpoint = args.find((a, i) => i > 0 && !a.startsWith('-') && args[i - 1] !== '-X' && args[i - 1] !== '--input');
  const base = `repos/${state.repo}`;
  if (method === 'GET' && endpoint === `${base}/rulesets?includes_parents=false`) {
    out(state.rulesets.map(({ id, name }) => ({ id, name, source: state.repo })));
  } else if (method === 'POST' && endpoint === `${base}/rulesets`) {
    const body = JSON.parse(input || fail('ruleset POST without a body'));
    state.nextId = (state.nextId ?? 100) + 1;
    state.rulesets.push({ id: state.nextId, ...body });
    save();
    out({ id: state.nextId });
  } else if (method === 'PUT' && endpoint.startsWith(`${base}/rulesets/`)) {
    const id = Number(endpoint.split('/').pop());
    const i = state.rulesets.findIndex((r) => r.id === id);
    if (i < 0) fail(`no ruleset ${id}`);
    state.rulesets[i] = { id, ...JSON.parse(input || fail('ruleset PUT without a body')) };
    save();
    out({ id });
  } else if (method !== 'GET' && [`${base}/private-vulnerability-reporting`, base, `${base}/vulnerability-alerts`, `${base}/automated-security-fixes`].includes(endpoint)) {
    state.security = state.security ?? {};
    state.security[input.trim() ? `${endpoint} ${input.trim()}` : endpoint] = method;
    save();
  } else {
    fail(`unknown api call: ${args.join(' ')}`, 3);
  }
} else {
  fail(`unknown call: ${args.join(' ')}`, 3);
}
