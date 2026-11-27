### Added

- `scripts/bootstrap.sh --own-forms` copies the issue forms of pacocartones/.github into a
  repository that needs its own. `npm run check` checks that any form of its own sets `type:`
  and only standard labels, that `MAINTAINERS.md` and `LICENSE` exist, and names the new home
  of an inherited file when a link points to it.

### Removed

- The template's issue forms, `config.yml` and `CODE_OF_CONDUCT.md`: new repositories inherit
  them from pacocartones/.github, and `scripts/bootstrap.sh` no longer rewrites `config.yml`.
