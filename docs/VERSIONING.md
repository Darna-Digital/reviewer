# Versioning: why we're at `0.2.8` and opencode is at `1.18.31`

A guide to reading version numbers, written to settle one specific question:
*"opencode releases in tiny increments like `1.18.31` — why are we still on
`0.2.8`, and can `electron-updater` be configured to do the same?"*

Short answer: we already do exactly the same thing. There is nothing to
configure, because we are already at the smallest step that exists.

---

## 1. The misconception

It is natural to read `1.18.31` as a *finer-grained* version than `0.2.8` — as
though opencode had unlocked a smaller unit of release, something like
`0.2.7.1`, while we are stuck taking bigger jumps.

That is not what is happening. Compare the two most recent steps on each side:

| Project  | Previous  | Current   | What moved        |
| -------- | --------- | --------- | ----------------- |
| opencode | `1.18.30` | `1.18.31` | third digit, `+1` |
| reviewer | `0.2.7`   | `0.2.8`   | third digit, `+1` |

Identical move. Same unit, same size. Both are one **patch** release.

## 2. A version is three counters, not a decimal number

The instinct that trips people up is reading `0.2.8` as a quantity, where
`1.18.31` looks "further along" or "more precise." It is not a number. It is
three independent counters, separated by dots:

```
  0  .  2  .  8
  │     │     └── PATCH  — how many patch releases since the last minor
  │     └──────── MINOR  — how many feature bumps since the last major
  └────────────── MAJOR  — how many breaking/landmark releases
```

So:

- `1.18.31` reads as: *"the 31st patch since `1.18.0`."*
- `0.2.8` reads as: *"the 8th patch since `0.2.0`."*

The digits are **counts of decisions already made**, not a position on a shared
scale. opencode's numbers are longer because they have published more releases
— 940 stable versions to our 8 — not because their releases are smaller.

A useful consequence: `1.18.31` is not "better" than `0.2.8`. A version number
is a log, not a score.

## 3. There is nothing smaller than a patch

The hoped-for `0.2.7.1` is not a valid option, and not because of a setting we
have left switched off. Semver defines exactly three numeric segments. Checked
against the official regex from [semver.org](https://semver.org):

```
0.2.7          VALID   major=0 minor=2 patch=7
0.2.8          VALID   major=0 minor=2 patch=8
0.2.7.1        INVALID  <- semver.parse() returns null
1.18.30        VALID   major=1 minor=18 patch=30
1.18.31        VALID   major=1 minor=18 patch=31
0.2.8-beta.42  VALID   major=0 minor=2 patch=8
```

opencode does not use a fourth segment either. Across **all 12,125** versions
they have ever published to npm — stable and prerelease — the number of dotted
numeric segments is `3`, every single time. There are no exceptions to find.

### Why a fourth segment is actively dangerous here

Shipping `0.2.8.1` would not merely be untidy — it breaks the desktop channels
in a way that cannot be repaired by a later release:

- `electron-updater` parses the running app's **own** version at startup. Given
  an unparseable version it throws `ERR_UPDATER_INVALID_VERSION`, so anyone who
  installs such a build is stranded there permanently — they can never
  auto-update *off* it.
- `release-beta` derives beta versions as `X.Y.Z-beta.<run>`, which would become
  the equally invalid `0.2.8.1-beta.<run>`.

### Why a prerelease is not a "0.5 step" either

`0.2.8-1` *is* valid semver, but semver sorts prereleases **below** their
release: `0.2.8-1 < 0.2.8`. So it can never act as a follow-up to `0.2.8`; it
describes something on the way *to* it. If you want to ship something after
`0.2.8`, the answer is always `0.2.9`.

## 4. What `electron-updater` actually does with the number

`electron-updater` (we pin `6.8.9` in `packages/desktop/package.json`) does one
thing with versions: it parses the published feed and the running app's version
as semver and compares them. If the feed is higher, it updates.

That is the entire contract. There is no granularity setting, no "increment
size" option, no way to teach it a fourth segment — the comparison is semver or
it is nothing. Our release cadence is therefore not limited by the updater in
any way.

**What actually sets our cadence is the pipeline.** `release-prod.yml` fires on
every push to `main`, but treats the version in
`packages/desktop/package.json` as the ship signal: if that version already has
a complete release, the run is a no-op. So every release needs a deliberate
`Release vX.Y.Z` commit written by hand. opencode auto-bumps the patch in CI on
every merge. That difference — manual bump vs. automated bump — is the real gap
between 8 releases and 940. It has nothing to do with the shape of the number.

## 5. The evidence

### opencode's actual release shape

Measured from the published npm version list (`npm view opencode-ai versions`):

| Metric                                     | Value                    |
| ------------------------------------------ | ------------------------ |
| Total published versions (incl. prerelease) | 12,125                  |
| Stable releases                            | 940                      |
| Distinct segment counts, all versions      | `3` — never a fourth     |
| Three most recent stable                   | `1.18.29 1.18.30 1.18.31` |

Patch releases per minor line in `1.x` (lines that published stable versions):

| Line     | Patch releases |
| -------- | -------------- |
| `1.0.x`  | 221            |
| `1.1.x`  | 64             |
| `1.2.x`  | 27             |
| `1.3.x`  | 18             |
| `1.4.x`  | 15             |
| `1.14.x` | 35             |
| `1.15.x` | 14             |
| `1.16.x` | 3              |
| `1.17.x` | 21             |
| `1.18.x` | 32             |

Median ≈ 24 patches per minor. The patch counter climbs into the twenties and
thirties, then a feature-carrying minor bump resets it to zero. **That reset is
the only reason their numbers stay short** — without it, 940 releases would
read `1.0.939`.

### Our actual release shape

```
2026-09-08  Release v0.2.2
2026-09-08  Release v0.2.3
2026-09-15  Release v0.2.4
2026-09-16  Release v0.2.5
2026-09-16  Release v0.2.6
2026-09-17  Release v0.2.7
2026-09-17  Release v0.2.8
```

Eight releases in ten days, four of them in the last two. The cadence is
healthy and accelerating. The version number is simply young.

## 6. "So will we reach `1.18.31` on our own?"

No — and it is worth being precise about which digits move by themselves:

| Digit     | Moves on its own?   | What moves it                                                                              |
| --------- | ------------------- | ------------------------------------------------------------------------------------------ |
| **Patch** | **Yes**             | Every release. Keep shipping and `0.2.9`, `0.2.10` … `0.2.31` arrive with no decision made. |
| **Minor** | No                  | A deliberate bump when a release carries a notable feature. Nothing bumps it for you.        |
| **Major** | No                  | A product decision. `RELEASING.md` reserves `1.0.0` for the public launch.                  |

Because the patch counter gets reset by minor bumps, the realistic path is not
a climb toward a long number but a cycle:

```
0.2.8 → 0.2.9 → … → 0.2.30ish → 0.3.0 → 0.3.1 → … → 0.4.0 → …
```

To land exactly on `1.18.31` we would need the public-launch call for `1.0.0`,
then eighteen feature-carrying minors, then thirty-one patches past the last
one — on opencode's own median, roughly 360 releases inside the `1.x` line
alone. It is not a milestone to progress toward. `0.2.8` is an accurate
description of where reviewer is: eight patches into the second minor,
pre-launch.

## 7. The rules that follow

1. **Patch is the default.** Fixes, dependency bumps, polish → `0.2.8` → `0.2.9`.
2. **Minor when a release carries a feature**, which resets the patch counter.
   If the patch number climbs past ~30, a minor is overdue — that is a signal
   about feature cadence, not a sign the scheme is broken.
3. **Never invent a fourth segment.** See §3. When tempted, take another patch.
4. **Never use a prerelease as a follow-up.** It sorts below the release.
5. **Both manifests move together** — root `package.json` and
   `packages/desktop/package.json`. `release-prod` reads the desktop one; a
   mismatch means the workflow republishes the old version and ships nothing:

   ```bash
   grep -h '"version"' package.json packages/desktop/package.json
   ```

6. **Want a longer version number? Release more often.** The number is an
   output of cadence, never an input to it.

## 8. Verify any of this yourself

```bash
# Every version opencode ever published, and how many segments each has
npm view opencode-ai versions --json

# Check a version string against the official semver grammar
node -e 'console.log(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(process.argv[1]))' 0.2.7.1

# Our own release history
git log --all --grep='^Release v' --date=short --pretty='%ad  %s'
```

---

See [`RELEASING.md`](../RELEASING.md) for the release channels, signing and
notarization, and `.claude/skills/release/SKILL.md` for the bump procedure.
