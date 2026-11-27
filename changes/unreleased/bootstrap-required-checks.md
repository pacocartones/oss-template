### Added

- `scripts/bootstrap.sh --check NAME` (repeatable) sets the checks the "main merge gate"
  ruleset requires, for a repository whose workflows name them differently from the
  template's four. Without it the four stay the default.
