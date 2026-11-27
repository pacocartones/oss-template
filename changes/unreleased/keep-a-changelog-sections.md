### Added

- `.github/workflows/scorecard.yml`: new public repositories start with the OpenSSF Scorecard
  workflow of the standard, copied from pacocartones/.github with its attribution, and
  `.github/actionlint.yaml` for its `cache-mode` key. A private repository deletes both.

### Changed

- **BREAKING:** changelog fragments use the six Keep a Changelog groups (Added, Changed,
  Deprecated, Removed, Fixed, Security); `### Breaking changes and upgrade` and
  `### Changed and fixed` are rejected by `npm run check`. Move their entries to `### Changed`,
  `### Fixed` or `### Removed`, with a `**BREAKING:**` line for a breaking change.
- A release pull request comes from `release/vX.Y.Z` instead of `chore/release-x-y-z`, and the
  commit policy is pinned to the pacocartones/.github commit that accepts that name.
