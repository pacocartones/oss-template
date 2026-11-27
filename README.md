# oss-template

The starting point for [@pacocartones](https://github.com/pacocartones)' open source repositories: policies, the pull request form, the shared label standard, changelog fragments, and CI wired to the reusable workflows in [`pacocartones/.github`](https://github.com/pacocartones/.github). The issue forms and the Code of Conduct are not copied: GitHub shows those of [`pacocartones/.github`](https://github.com/pacocartones/.github#community-health-files) in every repository without its own ([GitHub Docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file)). Distilled from [free-llm-api-hub](https://github.com/pacocartones/free-llm-api-hub).

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

4. **Run it.** It rewrites the template's name in `package.json`, syncs the labels, creates the rulesets *main integrity* (no deletion or force push, no bypass) and *main merge gate* (pull request, resolved conversations and the required checks; branches need not be up to date), and enables private vulnerability reporting, secret scanning, push protection and Dependabot security updates where the plan allows. Safe to rerun.

   ```bash
   scripts/bootstrap.sh
   ```

   Add `--prune-labels` to delete GitHub's default labels that are outside the standard (only unused ones are deleted).

   Add `--own-forms` only if the repository needs issue forms of its own: it copies the forms and `config.yml` of `pacocartones/.github` into `.github/ISSUE_TEMPLATE/` to edit there. Any form or `config.yml` in a repository turns off every inherited form, so the shared ones stop applying to it.
5. **Do the manual steps it prints**: move the reusable workflows' pinned SHA if `pacocartones/.github` has moved on, write the project's README, list the maintainers in `MAINTAINERS.md`, set the CodeQL language, add the project's checks to `package.json`, and a few settings.
6. **Commit on a branch and open a pull request.** The four checks (verify, commit policy, PR description, CodeQL) must pass before it merges.

   ```bash
   git switch -c chore/bootstrap
   git commit -am "chore: bootstrap from oss-template"
   git push -u origin chore/bootstrap
   gh pr create --fill
   ```

## What you get

- **CI that tests the template itself.** `npm test` runs `scripts/bootstrap.sh` (dry run, real run and rerun) against a simulated fresh copy with a fake `gh`, so no repository is created and nothing is written to GitHub; it checks the plan covers every label in `.github/labels.tsv`, both rulesets and the required checks, and that a second run changes nothing. It also tests every rule of `scripts/check-repo.mjs`, and that links to `pacocartones/.github` and the pinned workflows resolve there.
- **No agent attribution.** [`.claude/settings.json`](.claude/settings.json) sets empty commit and pull request attribution for Claude Code sessions.
- **Commit policy** from `pacocartones/.github`, pinned to a SHA: maintainer identity, no AI trailers in maintainer commits, branch names; and no AI footer in a maintainer's pull request description, checked again when it is edited.
- **OpenSSF Scorecard** on `main` (weekly, on pushes and on branch protection changes), copied from `pacocartones/.github` with its attribution ([THIRD_PARTY.md](THIRD_PARTY.md)). It is for public repositories only: a private repository deletes `.github/workflows/scorecard.yml` and `.github/actionlint.yaml`.
- **One merge at a time.** The merge gate does not require branches to be up to date, so maintainers merge one pull request at a time ([CONTRIBUTING.md](CONTRIBUTING.md#review)).
- **Generated files are never committed by hand** ([CONTRIBUTING.md](CONTRIBUTING.md#generated-files)).

## What's inside, and where each rule lives

Each fact is written once, in the file below; everything else links to it.

| File | Owns |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How a change gets in: claiming, good first issue criteria, response target, review |
| [`AI_POLICY.md`](AI_POLICY.md) | What we ask of AI-assisted contributions |
| [`GOVERNANCE.md`](GOVERNANCE.md) | How decisions are made |
| [`MAINTAINERS.md`](MAINTAINERS.md) | Who the maintainers are |
| [`SECURITY.md`](SECURITY.md) | Private reporting and scope |
| [`LICENSE`](LICENSE) | MIT, copyright holder |
| [`.github/labels.tsv`](.github/labels.tsv) | The shared label standard (labels v2: the kind of work is the issue type, not a label) |
| [`pacocartones/.github`](https://github.com/pacocartones/.github#community-health-files) | Inherited, not copied: the Code of Conduct, `SUPPORT.md` and the issue forms (one per issue type, each setting `type:`), unless a repository adds its own |
| [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) | What a pull request reports |
| [`changes/unreleased/README.md`](changes/unreleased/README.md) | The changelog fragment format |
| [`RELEASING.md`](RELEASING.md) | SemVer, tags and how fragments become `CHANGELOG.md` |
| [`.github/workflows/`](.github/workflows/) | Thin callers of `pacocartones/.github`, where the logic and its options live; and `scorecard.yml`, a copy of its Scorecard workflow |
| [`scripts/bootstrap.sh`](scripts/bootstrap.sh) | Repository settings, rulesets and the required check names |
| [`scripts/check-repo.mjs`](scripts/check-repo.mjs) | `npm run check`: labels, the type and labels of any issue form of its own, fragments, changelog, the files every repository keeps (`MAINTAINERS.md`, `LICENSE`) and links within the repository stay consistent |
| [`scripts/*.test.mjs`](scripts/) | `npm test`: the template's own tests (bootstrap, checks, workflow callers, `pacocartones/.github` links) |
| [`.claude/settings.json`](.claude/settings.json) | Claude Code settings shared by everyone working here |

## Changing the template

Repositories created from it do not follow later changes. Change shared CI behavior in `pacocartones/.github` (callers take it by moving their pinned SHA) and shared text here; port a text change to existing repositories by hand when it matters.
