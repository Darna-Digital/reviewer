#!/usr/bin/env bash
# Print where SwiftPM put the binaries for a configuration. `swift build
# --show-bin-path` is the supported way to ask; the path carries the host
# triple, so hard-coding `.build/debug` would break on the first toolchain
# that changes its layout.
#
# SCRATCH_PATH asks about a build directory other than .build — a release
# build kept apart from the watcher's, which holds a lock on its own.
set -euo pipefail
config="${1:-debug}"
cd "$(dirname "$0")/.."
swift build -c "$config" ${SCRATCH_PATH:+--scratch-path "$SCRATCH_PATH"} --show-bin-path
