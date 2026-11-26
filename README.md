# oss-template

The starting point for [@pacocartones](https://github.com/pacocartones)' open source repositories: policies, issue and pull request forms, the shared label standard, changelog fragments, and CI wired to the reusable workflows in [`pacocartones/.github`](https://github.com/pacocartones/.github). Distilled from [free-llm-api-hub](https://github.com/pacocartones/free-llm-api-hub).

## New repository in 10 minutes

You need [`gh`](https://cli.github.com/) (logged in, admin on the new repository), `jq`, `git` and Node 24.

1. **Create it.** On this page, *Use this template → Create a new repository*. Public.
2. **Clone it.**

   ```bash
   gh repo clone <owner>/<name> && cd <name>
   ```

3. **See what the bootstrap would do.** It only reads.

   ```bash
   scripts/bootstrap.sh --dry-run
   ```

4. **Run it.** It rewrites the template's name in the issue form links and `package.json`, syncs the labels, creates the rulesets *main integrity* (no deletion or force push, no bypass) and *main merge gate* (pull request, resolved conversations and the required checks; branches need not be up to date), and enables private vulnerability reporting, secret scanning, push protection and Dependabot security updates where the plan allows. Safe to rerun.

   ```bash
   scripts/bootstrap.sh
   ```

   Add `--prune-labels` to delete GitHub's default labels that are outside the standard (only unused ones are deleted).
5. **Do the manual steps it prints**: pin the reusable workflows to a SHA, write the project's README, list the maintainers in `GOVERNANCE.md`, set the CodeQL language, add the project's checks to `package.json`, and a few settings.
6. **Commit on a branch and open a pull request.** The three checks (verify, commit policy, CodeQL) must pass before it merges.

   ```bash
   git switch -c chore/bootstrap
   git commit -am "chore: bootstrap from oss-template"
   git push -u origin chore/bootstrap
   gh pr create --fill
   ```

## What's inside, and where each rule lives

Each fact is written once, in the file below; everything else links to it.

| File | Owns |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How a change gets in: claiming, good first issue criteria, response target, review |
| [`AI_POLICY.md`](AI_POLICY.md) | What we ask of AI-assisted contributions |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Maintainers and how decisions are made |
| [`SECURITY.md`](SECURITY.md) | Private reporting and scope |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | Expected behavior and enforcement |
| [`LICENSE`](LICENSE) | MIT, copyright holder |
| [`.github/labels.tsv`](.github/labels.tsv) | The shared label standard |
| [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) | Bug, data/content correction, feature, proposal and good first issue (maintainers) forms |
| [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) | What a pull request reports |
| [`changes/unreleased/README.md`](changes/unreleased/README.md) | The changelog fragment format |
| [`RELEASING.md`](RELEASING.md) | SemVer, tags and how fragments become `CHANGELOG.md` |
| [`.github/workflows/`](.github/workflows/) | Thin callers of `pacocartones/.github`; the logic and its options live there |
| [`scripts/bootstrap.sh`](scripts/bootstrap.sh) | Repository settings, rulesets and the required check names |
| [`scripts/check-repo.mjs`](scripts/check-repo.mjs) | `npm run check`: labels, issue form labels, fragments and changelog stay consistent |

## Changing the template

Repositories created from it do not follow later changes. Change shared CI behavior in `pacocartones/.github` (callers take it by moving their pinned SHA) and shared text here; port a text change to existing repositories by hand when it matters.
