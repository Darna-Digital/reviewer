#!/usr/bin/env bash
# Assemble Reviewer.app from a SwiftPM build. SwiftPM only produces a bare
# Mach-O; without a bundle macOS gives it no dock icon, no Info.plist (so no
# bundle identifier for defaults/ATS) and Finder cannot launch it. The bundle
# is rebuilt on every call, so it is always the configuration just built.
#
#   scripts/bundle.sh [debug|release]   (default: debug)
set -euo pipefail

config="${1:-debug}"
package_dir="$(cd "$(dirname "$0")/.." && pwd)"
bin_dir="$("${package_dir}"/scripts/bin-dir.sh "$config")"
app="${package_dir}/.build/Reviewer.app"
contents="${app}/Contents"

rm -rf "$app"
mkdir -p "${contents}/MacOS" "${contents}/Resources"
cp "${bin_dir}/Reviewer" "${contents}/MacOS/Reviewer"
cp "${package_dir}/Resources/Info.plist" "${contents}/Info.plist"

# Dependencies with resources — SwiftTerm's compiled Metal shaders — come out
# of SwiftPM as `<Package>_<Target>.bundle` beside the binary; inside an app
# they are looked for in Contents/Resources instead.
for resource_bundle in "${bin_dir}"/SwiftTerm_*.bundle; do
  [[ -d "$resource_bundle" ]] && cp -R "$resource_bundle" "${contents}/Resources/"
done

# A built SPA (`pnpm --filter spa build`) rides along as Contents/Resources/spa
# and the islands are served from it over `reviewer://app` — see SpaSource.
# Without one the app falls back to the working-tree build or the Vite dev
# server, so a missing build only skips this step.
spa_build="${package_dir}/../spa/dist/client"
if [[ -f "${spa_build}/_shell.html" ]]; then
  cp -R "$spa_build" "${contents}/Resources/spa"
fi

# The dock icon is the brand PNG under Resources/icons, turned into an .icns
# with the system tools. Every size macOS asks for is derived from the 1024px
# source with sips; the app still runs without an icon, so a missing PNG only
# skips this step.
brand_png="${package_dir}/Resources/icons/reviewer-icon-light.png"
if [[ -f "$brand_png" ]]; then
  iconset="${package_dir}/.build/Reviewer.iconset"
  rm -rf "$iconset" && mkdir -p "$iconset"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$brand_png" --out "${iconset}/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" "$brand_png" --out "${iconset}/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$iconset" -o "${contents}/Resources/Reviewer.icns"
fi

# Ad-hoc sign so the binary runs under the hardened-runtime defaults of a
# modern macOS without a "damaged app" dialog on first launch.
codesign --force --sign - "$app" >/dev/null 2>&1 || true

echo "$app"
