# Releasing

Merging a pull request is not releasing. Changes accumulate as [changelog fragments](changes/unreleased/README.md) until a maintainer decides to release.

## Rules

1. **Versioning:** [SemVer](https://semver.org/). A change that breaks a user of the public interface is a major version; new features are minor; fixes and corrections are patch. In `0.x`, a minor version may break, and the notes say so.
2. **Tags:** `vX.Y.Z`, annotated, never moved or deleted. Pre-releases are `vX.Y.Z-rc.N`, marked as pre-releases on GitHub.
3. **Source:** only from `main`, with every check green, from the merge commit of the release pull request.
4. **When:** a fix users are relying on or a security fix (release soon); or at least one change users would notice since the last release. Docs, tests, CI and refactors alone are not a reason to release.
5. **Notes:** in English, written from the collected fragments. Every entry cites its pull request; an entry for an outside contributor ends with `Thanks @user` (the author of the merged pull request).
6. **Attribution:** no AI attribution or AI co-author trailers in the title, the notes or the tag.

## Steps

1. From an up-to-date `main`, create a branch `chore/release-x-y-z`.
2. In `CHANGELOG.md`, add `## [X.Y.Z] - YYYY-MM-DD` (UTC day) under `## [Unreleased]`, with a one-paragraph summary: what changes for users and whether they need to do anything.
3. Move every fragment in `changes/unreleased/` (all files except `README.md`) under that heading: one block per section, in the order listed in the fragments README, entries from all fragments merged. Check each entry against the merged pull requests. Delete the moved fragments.
4. Bump the version wherever the project declares it (for example `npm version X.Y.Z --no-git-tag-version`).
5. Run the checks, commit `chore(release): vX.Y.Z` and open the pull request.
6. After it merges, tag the merge commit and publish the release on that tag, with the new changelog section as the notes:

   ```bash
   git switch main && git pull --ff-only
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   Then on GitHub: *Releases → Draft a new release*, choose the tag, title `vX.Y.Z - <one-line summary>`.
