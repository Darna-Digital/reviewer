#!/usr/bin/env bash
# Print where SwiftPM put the binaries for a configuration. `swift build
# --show-bin-path` is the supported way to ask; the path carries the host
# triple, so hard-coding `.build/debug` would break on the first toolchain
# that changes its layout.
set -euo pipefail
config="${1:-debug}"
cd "$(dirname "$0")/.."
swift build -c "$config" --show-bin-path
