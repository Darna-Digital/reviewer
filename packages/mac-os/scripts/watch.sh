#!/usr/bin/env bash
# Rebuild and relaunch Reviewer.app on every save — the nearest thing to the
# spa's HMR a native shell gets. A change under Sources/ or Resources/ (or to
# the package manifest) is a `swift build`, a fresh bundle, and the running app
# replaced by the new one. A build that fails leaves the old app up, prints
# the compiler's errors here, and waits for the next save.
#
#   scripts/watch.sh    (debug configuration, the same bundle `pnpm dev` opens)
#
# The tree is polled with `find -newer` once a second rather than watched with
# fswatch or watchexec, so this runs on a machine with nothing but the
# toolchain installed. The app is relaunched by its bundle path, which is also
# how the cmux stop script finds it.
set -euo pipefail

package_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$package_dir"

app="${package_dir}/.build/Reviewer.app"
stamp="${package_dir}/.build/watch.stamp"
watched=(Sources Resources Package.swift Package.resolved)

mkdir -p "${package_dir}/.build"

changed_since_stamp() {
  [[ -n "$(find "${watched[@]}" -type f -newer "$stamp" -print -quit 2>/dev/null)" ]]
}

# The short pause after the first changed file lets an editor finish a
# multi-file save before the build picks it up.
wait_for_change() {
  until changed_since_stamp; do sleep 1; done
  sleep 0.3
}

relaunch() {
  pkill -f "$app" 2>/dev/null || true
  local i=0
  while pgrep -f "$app" >/dev/null 2>&1; do
    if [[ $i -ge 50 ]]; then pkill -9 -f "$app" 2>/dev/null || true; break; fi
    i=$((i + 1))
    sleep 0.1
  done
  open "$app"
}

# The stamp is set before the build, so a save made while the compiler runs
# is not lost — it shows up as newer on the next poll.
build_and_relaunch() {
  touch "$stamp"
  if swift build && scripts/bundle.sh debug >/dev/null; then
    relaunch
    echo "✓ $(date +%H:%M:%S) Reviewer.app relaunched — watching ${watched[*]}"
  else
    echo "✗ $(date +%H:%M:%S) build failed — the running app stays up; save again to retry"
  fi
}

build_and_relaunch
while true; do
  wait_for_change
  echo "→ $(date +%H:%M:%S) change detected, rebuilding"
  build_and_relaunch
done
