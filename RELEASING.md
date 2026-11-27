# Releasing

Merging a pull request is not releasing. Changes accumulate as [changelog fragments](changes/unreleased/README.md) until a maintainer decides to release. No workflow publishes anything: a maintainer tags and publishes each release by hand.

## Rules

1. **Changelog:** `CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/): newest release first under `## [Unreleased]`, one `## [X.Y.Z] - YYYY-MM-DD` heading per release, the sections of the [fragments README](changes/unreleased/README.md), and comparison links at the bottom.
2. **Versioning:** [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html). A change that breaks a user of the public interface is a major version; new features are minor; fixes and corrections are patch. In `0.x`, a minor version may break, and the notes say so.
3. **Tags:** `vX.Y.Z`, annotated (`git tag -a`, never a lightweight tag, and never the one GitHub creates when a release names a new tag), never moved or deleted. Pre-releases are `vX.Y.Z-rc.N`, marked as pre-releases on GitHub.
4. **Source:** only from `main`, with every check green, from the merge commit of the release pull request.
5. **When:** a fix users are relying on or a security fix (release soon); or at least one change users would notice since the last release. Docs, tests, CI and refactors alone are not a reason to release.
6. **Notes:** in English, written from the collected fragments. Every entry cites its pull request; an entry for an outside contributor ends with `Thanks @user` (the author of the merged pull request).
7. **Attribution:** no AI attribution or AI co-author trailers in the title, the notes or the tag.

## Steps

1. From an up-to-date `main`, create a branch `chore/release-x-y-z`.
2. In `CHANGELOG.md`, add `## [X.Y.Z] - YYYY-MM-DD` (UTC day) under `## [Unreleased]`, with a one-paragraph summary: what changes for users and whether they need to do anything. At the bottom, point `[Unreleased]` at `compare/vX.Y.Z...HEAD` and add `[X.Y.Z]: https://github.com/<owner>/<name>/compare/vPREVIOUS...vX.Y.Z` (`releases/tag/vX.Y.Z` for the first release).
3. Move every fragment in `changes/unreleased/` (all files except `README.md`) under that heading: one block per section, in the order listed in the fragments README, entries from all fragments merged. Check each entry against the merged pull requests. Delete the moved fragments.
4. Bump the version wherever the project declares it (for example `npm version X.Y.Z --no-git-tag-version`).
5. Run the checks, commit `chore(release): vX.Y.Z` and open the pull request.
6. After it merges, tag the merge commit and publish the release on that tag, with the new changelog section as the notes:

   ```bash
   git switch main && git pull --ff-only
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   Then publish the release on the existing tag, title `vX.Y.Z - <one-line summary>`; `--verify-tag` refuses to create a tag if the push did not land:

   ```bash
   gh release create vX.Y.Z --verify-tag --title "vX.Y.Z - <one-line summary>" --notes-file <the new section>
   ```

## release-please, for a small single-package repository

A repository with one package and Conventional Commit titles can let [release-please](https://github.com/googleapis/release-please) do steps 1, 4 and 5: it reads the commits since the last tag, picks the next SemVer version and opens the release pull request with the version bumped. It replaces nothing else above: fragments still make the changelog, a maintainer still tags and publishes, and no workflow is added. Use it only where it saves work; a repository that releases a few times a year does not need it.

Two settings keep it inside the rules:

- `skip-changelog: true`. Release-please writes its own changelog from commit messages, with its own headings, and inserts each release above the first version-like heading, which is `## [Unreleased]`. Fragments stay the source (step 3, done on its branch).
- `skip-github-release: true`. Its GitHub release would create a lightweight tag. With this setting it finds the last release by its `vX.Y.Z` tag.

`release-please-config.json` and `.release-please-manifest.json` at the root (`release-type` `node` for a `package.json`, `simple` for a `version.txt`):

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "include-component-in-tag": false,
      "skip-changelog": true,
      "skip-github-release": true
    }
  }
}
```

```json
{ ".": "X.Y.Z" }
```

The manifest holds the last released version, and the tag `vX.Y.Z` must exist for it. Then, per release:

1. A maintainer runs it with their own token, so the pull request is theirs and the required checks run on it (one opened by a workflow's `GITHUB_TOKEN` starts no checks). It works through the API and reads both files from `main`, so merge them there first:

   ```bash
   npx release-please@17 release-pr --token "$(gh auth token)" --repo-url <owner>/<name> --config-file release-please-config.json --manifest-file .release-please-manifest.json
   ```

2. On its branch, do steps 2 and 3 above in one commit, then run the checks. Running `release-pr` again rewrites the branch and drops that commit; add it again if you do.
3. Merge, then tag and publish as in step 6.
4. Move the pull request's label from `autorelease: pending` to `autorelease: tagged` (`gh pr edit <number> --remove-label "autorelease: pending" --add-label "autorelease: tagged"`). Until then release-please opens no new release pull request. Both labels are outside `.github/labels.tsv` and stay because they are in use (`scripts/bootstrap.sh` keeps labels that are on an issue or pull request).
