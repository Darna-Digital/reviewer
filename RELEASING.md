# Releasing Reviewer

Reviewer ships as one thing: the native macOS app in `packages/mac-os`,
distributed as a signed, notarized disk image on this repository's GitHub
releases. There is one channel and no beta.

## Branches

| Branch          | What it is                         | What a push does                              |
| --------------- | ---------------------------------- | --------------------------------------------- |
| feature branch  | work in progress                   | nothing — its pull request runs CI            |
| `staging`       | where development happens          | nothing                                       |
| `main`          | what has shipped, or is shipping   | releases, **if** the version is new           |

Work lands on `staging` through pull requests. Promote it with a
`staging` → `main` merge.

## CI and CD

| Workflow         | Trigger                    | Does                                                                 |
| ---------------- | -------------------------- | -------------------------------------------------------------------- |
| `check.yml`      | every pull request         | lint, format check, tests (Ubuntu)                                   |
| `mac.yml`        | pull requests (not www/docs-only) | builds `Reviewer.app` on `macos-26`, ad-hoc signed — proves it still builds |
| `release.yml`    | push to `main`             | if the version is unreleased: check, build, sign, notarize, publish  |
| `deploy-www.yml` | push to `main` touching `packages/www` | deploys reviewer.darnadigital.com                        |

`release.yml` first reads the root `package.json` version and looks for a
published release `vX.Y.Z` carrying a disk image. If there is one, the run
ends there in seconds — so merges that don't bump the version ship nothing.
If there isn't:

1. `check.yml` runs; a red check stops the release.
2. On a `macos-26` runner, the Developer ID certificate is imported and
   `pnpm build:mac` builds the SPA, the server bundle and the Swift package,
   and `scripts/bundle.sh` assembles `Reviewer.app` and stamps it with the
   version. Handed a `Developer ID Application: …` identity, `bundle.sh`
   signs every Mach-O with the hardened runtime and a secure timestamp —
   node-pty's `pty.node` and `spawn-helper` included.
3. `scripts/release.sh` notarizes and staples the app, wraps it in
   `Reviewer-X.Y.Z-arm64.dmg`, then signs, notarizes and staples that too,
   and checks both with `spctl` the way a downloader's Mac will.
4. `gh release create vX.Y.Z` publishes the image as the latest release,
   with notes GitHub generates from what merged since the previous version.

A run that fails midway leaves no published release, so re-running it (or
pushing again) picks up where it should. It can also be started by hand from
the Actions tab (**release → Run workflow**).

## Versioning

The root `package.json` `version` is the only place the version lives;
`bundle.sh` writes it into both Info.plists (the app's and the widget's) at
build time. The Info.plist values in the repository are never read.

- Every release is a **patch**: `0.0.1` → `0.0.2` → `0.0.3` …
- Plain `X.Y.Z` semver only. `0.0.1.1` is not a version, and a prerelease
  like `0.0.2-1` sorts *below* `0.0.2`. When in doubt, take the next patch.
- **Taken tags.** The retired Electron app released `v0.1.0` and
  `v0.2.0`–`v0.2.8` here. `release.yml` never overwrites a release it
  didn't make; a version that collides fails the run. A minor bump, if one
  is ever wanted, goes straight to `0.3.0`.

## Cutting a release

1. Merge `staging` into `main` (or merge the pull request that does).
2. Bump the patch in the root `package.json`, commit as `Release vX.Y.Z`, and
   push to `main`.
3. Merge `main` back into `staging`, so both sit on the released commit.
4. Watch the run: `gh run watch $(gh run list -w release -L 1 --json databaseId -q '.[0].databaseId')`.

The `release` Claude skill (`.claude/skills/release`) walks through the same
steps.

## What users get

- Apple silicon only (`arm64`) — the runner builds for its own architecture.
- macOS 26 or later.
- `node` on the login shell's `PATH`: the app starts its bundled server with
  it (see `ServerLauncher`).
- No auto-update yet — a new version is a new download. The repository is
  private, so downloading needs access to it.

## Secrets

Set in **Settings → Secrets and variables → Actions** of `Darna-Digital/reviewer`:

| Secret                       | What                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | base64 of the Developer ID Application `.p12`              |
| `APPLE_CERTIFICATE_PASSWORD` | that `.p12`'s password                                     |
| `APPLE_API_KEY`              | base64 of the App Store Connect API key (`.p8`)            |
| `APPLE_API_KEY_ID`           | that key's ID                                              |
| `APPLE_API_ISSUER`           | that key's issuer UUID                                     |

`GITHUB_TOKEN` is built in; it publishes the release.

## A notarized build on your own Mac

With the Developer ID certificate in your keychain and an API key on disk:

```bash
pnpm --filter spa build && pnpm --filter @reviewer/embedded-server build:bundle
cd packages/mac-os
swift build -c release --scratch-path .build-release
SIGN_IDENTITY="Developer ID Application: …" SCRATCH_PATH=.build-release \
  APP_PATH=.build-release/Reviewer.app scripts/bundle.sh release
SIGN_IDENTITY="Developer ID Application: …" APPLE_API_KEY_PATH=AuthKey_XXXX.p8 \
  APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER=<uuid> \
  scripts/release.sh .build-release/Reviewer.app .build-release/dist
```

The separate scratch path keeps this off `scripts/watch.sh`'s `.build`.

## When notarization fails

`release.sh` prints the notary service's log for a rejected submission; the
usual cause is a Mach-O signed without the hardened runtime or a timestamp.
To look at past submissions:

```bash
xcrun notarytool history --key AuthKey_XXXX.p8 --key-id XXXX --issuer <uuid>
```
