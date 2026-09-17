---
name: release
description: Invoke when user asks to relase a new version.
---

# Release

## Pick the smallest bump that fits

Releases are meant to be frequent and small. Two moves only:

- **Patch** (`0.2.7` → `0.2.8`) — the default. Fixes, dependency bumps,
  polish. Use this unless the release is carrying a feature.
- **Minor** (`0.2.8` → `0.3.0`) — a notable or user-facing feature. This
  resets the patch counter to zero.

Never bump major unless the user asks in so many words.

**Frequent releases do not mean long version numbers.** opencode has shipped
940 stable releases and sits at `1.18.31` — the numbers stay short because a
minor bump every so often resets the patch counter. Across its `1.x` lines the
median is about 20 patches before a minor, ranging from 2 to 65. So roughly
every ten to thirty patch releases, a feature should be carrying a minor bump.
If the patch number is climbing past ~30, that is the signal a minor is
overdue, not that the scheme is broken.

## There is nothing smaller than a patch

Do not invent a fourth segment: `0.2.8.1` is **not** valid semver
(`semver.parse` returns `null`) and it breaks the desktop channels hard —
`electron-updater` throws `ERR_UPDATER_INVALID_VERSION` against the app's *own*
version at startup, so anyone who installs such a build can never auto-update
off it. `release-beta` would also derive the invalid `0.2.8.1-beta.<run>`.

A prerelease like `0.2.8-1` is valid but sorts *below* `0.2.8`, so it cannot
act as a follow-up to a release. When in doubt, take another patch.

## Both manifests move together

Two files carry the version and they must always match:

- `package.json` (root)
- `packages/desktop/package.json` — **this is the one `release-prod` reads**
  to decide what to publish

Bumping only the root leaves the desktop workflow republishing the old version
and shipping nothing. Check both after editing:

```bash
grep -h '"version"' package.json packages/desktop/package.json
```

## Steps

1. Read the current version from `package.json`.
2. Decide patch or minor by the rule above, and set both manifests to it.
3. Commit — subject `Release vX.Y.Z`, matching the existing history.
4. Push to `main`, then merge `main` into `staging`, then `staging` into
   `development`, so all three branches sit on the released commit.

Anything still waiting in a pull request is not in the release. Promote the
content first (`development` → `staging` → `main`), then bump, or the release
ships nothing new.

## What the push sets off

The version bump is the deliberate "ship it" signal — `release-prod` skips any
push that does not change it.

- **`main`** → signed **and notarized** production build, published to
  `darna-digital/reviewer`. Real users **auto-update** from this, so a push to
  `main` reaches them.
- **`staging`** → signed, un-notarized beta `X.Y.Z-beta.<run>`, published to
  `darna-digital/reviewer-beta`. Manual download only.

Both channels run `check.yml` (lint, format, test) first and will not publish
if it fails, so confirm the branch is green before pushing.

`RELEASING.md` has the full channel and signing detail.
