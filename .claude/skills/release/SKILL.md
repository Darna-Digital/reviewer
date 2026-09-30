---
name: release
description: Invoke when user asks to relase a new version.
metadata:
  internal: true
---

# Release

Reviewer ships as the macOS app only. A push to `main` whose root
`package.json` version has no release yet builds, signs, notarizes and
publishes it (`.github/workflows/release.yml`). Nothing else releases —
`staging` is the development branch and a push there does nothing.
`RELEASING.md` has the full pipeline.

## Every release is +0.0.1

`0.0.1` → `0.0.2` → `0.0.3` … Bump the patch, always. Only bump minor or
major when the user asks in so many words — and a minor goes to `0.3.0`,
because the retired Electron app holds the tags `v0.1.0` and
`v0.2.0`–`v0.2.8`, and `release.yml` fails rather than overwrite them.

## There is nothing smaller than a patch

Do not invent a fourth segment: `0.0.1.1` is **not** valid semver. A
prerelease like `0.0.2-1` is valid but sorts *below* `0.0.2`, so it cannot
act as a follow-up to a release. When in doubt, take another patch.

## Where the version lives

The root `package.json` `version` is the single source of truth.
`packages/mac-os/scripts/bundle.sh` stamps it into the app's and the
widget's Info.plist at build time — never edit the version there.

```bash
grep -h '"version"' package.json
```

## Steps

1. Make sure what should ship is on `main`: anything still on `staging` or
   in a pull request is not in the release. Promote with a
   `staging` → `main` merge first.
2. Read the current version from `package.json` and bump the patch.
3. Write the changelog entry (see below) into `CHANGELOG.md`.
4. Commit the version bump and the changelog together — subject
   `Release vX.Y.Z`, matching the existing history.
5. Push to `main`, then merge `main` into `staging` so both sit on the
   released commit.
6. Watch the run and report how it ended:

   ```bash
   gh run watch $(gh run list -w release -L 1 --json databaseId -q '.[0].databaseId')
   ```

   On success, `gh release view vX.Y.Z` shows the disk image.

`check.yml` (lint, format, test) runs first and a red check stops the
release, so confirm `main` is green before pushing.

## Changelog

`CHANGELOG.md` at the repo root holds one section per release, newest
first. Create it with a `# Changelog` heading if it does not exist yet.

`release.yml` publishes the entry as the GitHub release's body and as the
notes in the app's update window, so it is what users read. It finds the
entry by its `## vX.Y.Z` heading — keep that exact form (anything after the
version must follow a space), and do not add other `## ` headings inside it.

### Collect the commits

Work is pushed rather than merged through pull requests, so the commit
subjects are the record. The previous release is the tag just below the new
version **by version order, not date** — the Electron-era tags (`v0.1.0`,
`v0.2.x`) sit above the mac app's versions, so `git describe` picks the
wrong one. Fetch tags first; a local checkout often lacks the latest.

```bash
git fetch --tags --quiet
new=X.Y.Z
prev="$( (git tag -l 'v[0-9]*' | sed 's/^v//'; echo "$new") | sort -uV | grep -B1 -x "$new" | head -1)"
git log --no-merges --format='%h %s%n%b' "v${prev}..HEAD" | grep -v '^[0-9a-f]* Release v'
```

This is the same range `release.yml` falls back to when an entry is missing.
Read the bodies too, and `git show --stat <sha>` when a subject is too terse
to tell what changed for the user.

### Write the entry

```markdown
## vX.Y.Z — YYYY-MM-DD

### Added
- …

### Changed
- …

### Fixed
- …
```

- Write for someone using the app, not for the person who wrote the code:
  what they can now do or will notice, in plain words. Rewrite subjects
  rather than pasting them.
- Sort each commit into **Added**, **Changed** or **Fixed**; drop any
  heading that ends up empty.
- Merge commits that are parts of one change into a single line.
- Leave out what does not ship in the app: CI, release tooling, tests,
  refactors, lint/format, docs, and the marketing site (reviewer.sh).
  A commit that only touches `packages/www` or `.github` does not belong.
- If nothing user-facing remains, write a single `- Internal improvements.`
  line rather than an empty section.

Show the entry to the user before committing so they can adjust the wording.
