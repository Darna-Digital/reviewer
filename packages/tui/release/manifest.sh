#!/usr/bin/env bash
# Write install-manifest.txt, what install.sh reads to install a release:
# its version, the Node.js its server runs on, and the SHA-256 of every file
# install.sh downloads — the release's tarballs, and nodejs.org's own
# tarballs for the pinned version, read from nodejs.org's SHASUMS256.txt here
# so an install trusts one file, from the release it installs.
#
#   version 0.0.40
#   node 24.21.0
#   sha256 reviewer-darwin-arm64.tar.gz <hex>
#   sha256 node-v24.21.0-darwin-arm64.tar.gz <hex>
#
#   release/manifest.sh <dir-of-tarballs> > install-manifest.txt
set -euo pipefail

dir="${1:?usage: manifest.sh <dir-of-tarballs>}"
repo_dir="$(cd "$(dirname "$0")/../../.." && pwd)"
version="$(node -p "require('${repo_dir}/package.json').version")"
node_version="$(tr -d '[:space:]' < "${repo_dir}/packages/embedded-server/node-version")"

if command -v sha256sum >/dev/null; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
else
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
fi

echo "version ${version}"
echo "node ${node_version}"
shopt -s nullglob
tarballs=("$dir"/reviewer-*.tar.gz)
[[ ${#tarballs[@]} -gt 0 ]] || { echo "✗ no reviewer-*.tar.gz in ${dir}" >&2; exit 1; }
node_sums="$(curl -fsSL "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt")"
for tarball in "${tarballs[@]}"; do
  name="$(basename "$tarball")"
  echo "sha256 ${name} $(sha256 "$tarball")"
  platform="${name#reviewer-}"
  node_tarball="node-v${node_version}-${platform}"
  node_sum="$(awk -v file="$node_tarball" '$2 == file { print $1 }' <<<"$node_sums")"
  [[ -n "$node_sum" ]] || { echo "✗ nodejs.org lists no ${node_tarball}" >&2; exit 1; }
  echo "sha256 ${node_tarball} ${node_sum}"
done
