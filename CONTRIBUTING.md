# Contributing

Thanks for helping. This page says how a change gets in; each rule it mentions is defined once, in the file it links to.

## Your first contribution

1. **Choose** an [unassigned good first issue](../../issues?q=is%3Aissue+is%3Aopen+no%3Aassignee+label%3A%22good+first+issue%22), or a [help wanted](../../issues?q=is%3Aissue+is%3Aopen+no%3Aassignee+label%3A%22help+wanted%22) one once you know the repository. Read its latest comments and linked pull requests first.
2. **Claim** it (see [below](#claiming-an-issue)).
3. **Fork, branch and change** the files the issue names. Anything larger than a small fix starts as a proposal issue, so the approach is agreed before you write code.
4. **Check** your change with `npm ci --ignore-scripts`, then `npm test` and `npm run check` where `package.json` defines them, plus any check the issue names.
5. **Open a pull request** against `main`, fill in the template, link the issue and paste the commands you ran with their results. A check you could not run is reported with its error, not ticked.

Your first pull request's checks wait until a maintainer approves them (a GitHub default for first-time contributors). That says nothing about your change; push to the same branch rather than closing and reopening.

## Claiming an issue

Comment on the issue that you'd like to take it, and wait for a maintainer to assign you. Hold at most two assigned issues at a time. If you stop, say so in the issue: that's completely fine. An assigned issue with no activity for two weeks may be offered to someone else after a ping. A pull request for an issue assigned to someone else waits for them.

## Good first issues

An issue carries `good first issue` only if all of these hold:

1. it can be done from public sources, with no third-party account or payment;
2. it touches one or two files, named in the issue;
3. it names a check that must pass;
4. it takes under about two hours for someone new to the repository;
5. it is unclaimed: no assignee and no open pull request;
6. a maintainer reviewed it in the last 30 days.

Labels and their meanings are in [`.github/labels.tsv`](.github/labels.tsv).

## Changelog

A change users would notice adds one changelog fragment; [`changes/unreleased/README.md`](changes/unreleased/README.md) says how. Docs, tests and CI changes need none. Never edit `CHANGELOG.md` directly: [RELEASING.md](RELEASING.md) collects the fragments.

## Commits

- Write messages that say what changed and why.
- AI help is welcome under the [AI policy](AI_POLICY.md). Contributors keep their own identity and attribution choices.
- Maintainer commits use the maintainer's documented name and email and carry no AI attribution trailers or footers. The `commit policy` check enforces this, and the branch-name rule for branches in this repository (forks are not checked); both are defined in [`pacocartones/.github`](https://github.com/pacocartones/.github#commit-policy).

## Review

We aim to answer new issues, pull requests and claim requests within 3 business days, best effort. A real answer is a review, a question or an assignment, not an acknowledgement. Security reports follow [SECURITY.md](SECURITY.md).

A human maintainer reviews and is responsible for every merge; automated review comments are advisory. Every review conversation is resolved before merging, by a change or a note saying why not. Contributions are voluntary; requests for payment get no reply.

Maintainers merge one pull request at a time. The merge gate does not require a branch to be up to date with `main`, so two pull requests that pass on their own can still break `main` together: after a merge, update the next pull request from `main` and wait for its checks before merging it.

## Generated files

A file that a script or a bot produces is never edited or committed by hand: change its source and let the generator write it, in CI or with the command its header names. Each generated file starts with a line saying which command writes it.

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and to license your contribution under the [MIT License](LICENSE). How decisions are made: [GOVERNANCE.md](GOVERNANCE.md).
