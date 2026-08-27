# Releasing Byconvo (desktop)

Two channels, each a separate signed app with its own release feed:

| Channel | Trigger | Publishes to | Signed | Notarized | Auto-update |
| --- | --- | --- | --- | --- | --- |
| **Beta** | push to `staging` | `darna-digital/byconvo-beta` | yes | no | no (manual download) |
| **Production** | push to `main` | `darna-digital/byconvo` | yes | yes | yes |

Local dev is unchanged: `pnpm dev:desktop`. It defaults to the production app
identity and never touches CI or signing.

## Versioning

`packages/desktop/package.json`'s `version` is the single source of truth
(plain semver). Pre-1.0 while the app is young: bump **minor** for features,
**patch** for fixes; reserve **1.0.0** for the public launch.

Beta builds derive their version automatically as `X.Y.Z-beta.<run-number>`, so
they preview the `X.Y.Z` you are working toward.

## The flow

1. **Feature work → `staging`.** Every push to `staging` publishes a signed
   beta (`X.Y.Z-beta.N`) to `byconvo-beta`. Testers download the newest one and,
   on first launch of a build, **right-click → Open** once (beta is signed but
   not notarized, so Gatekeeper prompts once per build).
2. **Ready to ship?** Make sure `packages/desktop/package.json` holds the version
   you intend to release, then promote `staging → main`.
3. **`main` publishes production.** `release-prod` builds the package version
   and publishes it **only if that version has not already been released** — so
   the version bump is the deliberate "ship it" signal, and merges that don't
   change the version are no-ops. Real users auto-update from this release.

## Notarization notes

- Production notarization is an automated Apple security scan (signing + malware
  check), not App Store review. A correctly signed build gets `Accepted`.
- The **first** notarization on a brand-new Apple Developer account can take
  **hours** while Apple vets the account; every submission after that is minutes.
- Inspect status directly with:
  `xcrun notarytool history --key <AuthKey.p8> --key-id <id> --issuer <uuid>`
  and `xcrun notarytool log <submission-id> ...` for the detailed result.

## Required GitHub secrets (in `darna-digital/byconvo`)

- `BETA_GITHUB_TOKEN` — PAT with `contents:write` on `byconvo-beta`
- `APPLE_CERTIFICATE` — base64 of the Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD` — password for that `.p12`
- `APPLE_API_KEY` — base64 of the App Store Connect API `.p8`
- `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` — that key's ID and issuer
