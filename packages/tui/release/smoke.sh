#!/usr/bin/env bash
# Prove a release tarball runs before it ships: the binary prints the version
# it was stamped with, and the server inside it answers on its own, on the
# Node.js the build ran with (install.sh links nodejs.org's in its place).
#
#   release/smoke.sh reviewer-<os>-<arch>.tar.gz
set -euo pipefail

tarball="${1:?usage: smoke.sh <tarball>}"
work="$(mktemp -d)"
server_pid=""
cleanup() {
  [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

tar -xzf "$tarball" -C "$work"
release="$(find "$work" -mindepth 1 -maxdepth 1 -type d | head -1)"
echo "reviewer --version: $("${release}/reviewer" --version)"

port=41899
REVIEWER_PORT="$port" REVIEWER_DB="${work}/reviewer.db" HOME="$work" \
  node "${release}/server/main.cjs" >"${work}/server.log" 2>&1 &
server_pid=$!
for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:${port}/api/workspace" >/dev/null 2>&1; then
    echo "server answered on :${port}"
    exit 0
  fi
  sleep 0.5
done
echo "✗ the bundled server did not answer" >&2
cat "${work}/server.log" >&2
exit 1
