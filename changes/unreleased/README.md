# Changelog fragments

Each pull request with a change users would notice adds one file here, `changes/unreleased/<short-name>.md` (lowercase letters, digits and hyphens), so no two pull requests edit the same lines of `CHANGELOG.md`. Docs, tests and CI changes need none.

A fragment uses the changelog's own format: one or more section headings, each followed by entries starting with `- ` (continuation lines indented by two spaces). The sections, in release order:

- `### Breaking changes and upgrade`
- `### Added`
- `### Changed and fixed`
- `### Removed`
- `### Security`

Example, `changes/unreleased/fix-empty-input.md`:

```markdown
### Changed and fixed

- An empty input file now gives a clear error instead of a crash (#42).
```

Write the pull request number if you know it; the maintainer adds it, and `Thanks @user` for outside contributors, otherwise. `npm run check` checks the format. The release moves every fragment into `CHANGELOG.md` and deletes it ([RELEASING.md](../../RELEASING.md)); this README stays.
