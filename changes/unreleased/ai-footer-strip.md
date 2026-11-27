### Added

- `.github/workflows/ai-footer.yml`: calls pacocartones/.github's `ai-footer-strip.yml`, which
  removes an AI footer line from issues, pull request descriptions, comments and reviews written
  by the maintainer account.

### Changed

- The callers of pacocartones/.github are pinned to `927bf39` (main 2026-11-27); the reusable
  workflows they call are the same as at `e20cca0`.
