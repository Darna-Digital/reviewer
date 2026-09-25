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
3. Commit — subject `Release vX.Y.Z`, matching the existing history.
4. Push to `main`, then merge `main` into `staging` so both sit on the
   released commit.
5. Watch the run and report how it ended:

   ```bash
   gh run watch $(gh run list -w release -L 1 --json databaseId -q '.[0].databaseId')
   ```

   On success, `gh release view vX.Y.Z` shows the disk image.

`check.yml` (lint, format, test) runs first and a red check stops the
release, so confirm `main` is green before pushing.
