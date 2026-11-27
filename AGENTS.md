# Working in this repository

- The issue forms, code of conduct and support page are inherited from [pacocartones/.github](https://github.com/pacocartones/.github): read them there, they are not in this clone. How a change gets in: [CONTRIBUTING.md](CONTRIBUTING.md); AI-assisted work: [AI_POLICY.md](AI_POLICY.md).
- Agents never merge, not even their own pull request: open a draft and leave the merge to the maintainers in [MAINTAINERS.md](MAINTAINERS.md).
- A user-visible change adds a fragment in [`changes/unreleased/`](changes/unreleased/README.md) instead of editing `CHANGELOG.md`.
- Every workflow: `permissions: {}` at the top and the narrowest permissions per job, actions pinned by full commit SHA with the version as a comment, `persist-credentials: false` on checkout, no `pull_request_target` with a checkout of the pull request.
