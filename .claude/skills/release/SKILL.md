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
(`semver.parse` returns `null`). A prerelease like `0.2.8-1` is valid but sorts
*below* `0.2.8`, so it cannot act as a follow-up to a release. When in doubt,
take another patch.

## Where the version lives

The root `package.json` `version` is the single source of truth (plain
semver). Check it after editing:

```bash
grep -h '"version"' package.json
```

## Steps

1. Read the current version from `package.json`.
2. Decide patch or minor by the rule above, and set the manifest to it.
3. Commit — subject `Release vX.Y.Z`, matching the existing history.
4. Push to `main`, then merge `main` into `staging`, then `staging` into
   `development`, so all three branches sit on the released commit.

Anything still waiting in a pull request is not in the release. Promote the
content first (`development` → `staging` → `main`), then bump, or the release
ships nothing new.

`check.yml` (lint, format, test) runs on every pull request, so confirm the
branch is green before pushing.
