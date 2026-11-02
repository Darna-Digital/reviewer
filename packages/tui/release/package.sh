#!/usr/bin/env bash
# Build the TUI's release tarball for the machine it runs on:
#
#   reviewer-<os>-<arch>/
#     reviewer                      the TUI, compiled with Bun, version stamped in
#     server/main.cjs               the embedded server's esbuild bundle
#     server/node_modules/@lydell/  node-pty and its prebuilt for this platform
#
# Node.js is not inside: install.sh fetches the version pinned in
# packages/embedded-server/node-version from nodejs.org into a cache shared by
# every installed release and links it in as server/node, so an upgrade that
# keeps the pin downloads only this tarball.
#
# Run after `pnpm install` and `pnpm --filter @reviewer/embedded-server
# build:bundle`. On macOS, a "Developer ID Application: …" SIGN_IDENTITY signs
# every Mach-O with the hardened runtime, and the App Store Connect key
# variables (APPLE_API_KEY_PATH, APPLE_API_KEY_ID, APPLE_API_ISSUER) notarize
# them; without them the tarball is built unsigned, as on a pull request.
#
#   release/package.sh <out-dir>
#
# Prints the tarball's path on stdout; everything else goes to stderr.
set -euo pipefail

out_dir="${1:?usage: package.sh <out-dir>}"
tui_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "${tui_dir}/../.." && pwd)"
server_bundle="${repo_dir}/packages/embedded-server/dist/main.cjs"
[[ -f "$server_bundle" ]] || {
  echo "✗ no ${server_bundle} — run pnpm --filter @reviewer/embedded-server build:bundle" >&2
  exit 1
}

version="$(node -p "require('${repo_dir}/package.json').version")"
os="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "✗ unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac
name="reviewer-${os}-${arch}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
stage="${work}/${name}"
mkdir -p "${stage}/server/node_modules/@lydell" "$out_dir"

(cd "$tui_dir" && bun build --compile --no-compile-autoload-dotenv --minify \
  --define "REVIEWER_VERSION=\"${version}\"" \
  src/main.tsx src/diff/highlightWorker.ts --outfile "${stage}/reviewer") >&2

# node-pty stays outside the bundle, being native: copied beside it with
# pnpm's links followed, and only this platform's prebuilt.
cp "$server_bundle" "${stage}/server/main.cjs"
node_pty="$(cd "${repo_dir}/packages/embedded-server/node_modules/@lydell/node-pty" && pwd -P)"
cp -RL "$node_pty" "${stage}/server/node_modules/@lydell/"
cp -RL "$(dirname "$node_pty")/node-pty-${os}-${arch}" "${stage}/server/node_modules/@lydell/"

if [[ "$os" == "darwin" && "${SIGN_IDENTITY:-}" == "Developer ID Application: "* ]]; then
  codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" \
    --entitlements "${tui_dir}/release/reviewer.entitlements" "${stage}/reviewer" >&2
  while IFS= read -r -d '' binary; do
    if file -b "$binary" | grep -q 'Mach-O'; then
      codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$binary" >&2
    fi
  done < <(find "${stage}/server/node_modules" -type f \( -name '*.node' -o -perm -u+x \) -print0)
  if [[ -n "${APPLE_API_KEY_PATH:-}" ]]; then
    ditto -c -k --keepParent "$stage" "${work}/${name}.zip"
    "${repo_dir}/packages/mac-os/scripts/notarize.sh" "${work}/${name}.zip"
  fi
fi

stamped="$("${stage}/reviewer" --version)"
if [[ "$stamped" != "$version" ]]; then
  echo "✗ the binary says ${stamped}, package.json says ${version}" >&2
  exit 1
fi

tar -czf "${out_dir}/${name}.tar.gz" -C "$work" "$name"
echo "${out_dir}/${name}.tar.gz"
