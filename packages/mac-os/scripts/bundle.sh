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

# The dock icon is the Icon Composer bundle under Resources/Reviewer.icon,
# compiled with actool into Assets.car (light, dark, clear and tinted
# renderings, masked to the macOS 26 squircle by the system) plus a flat
# Reviewer.icns for anything that still reads CFBundleIconFile. Info.plist
# names both via CFBundleIconName/CFBundleIconFile.
#
# The system only shows the dark rendering under the "Dark" icon style in
# Appearance settings, never just because the Mac is in dark mode. To follow
# the system appearance regardless, the app swaps the dock tile itself (see
# DockIcon), which needs the dark rendering as a second flat file: the same
# bundle is compiled once more with its dark fills promoted to the default,
# and that build's .icns becomes Reviewer-dark.icns.
#
# actool ships with Xcode, not the Command Line Tools; without it the brand
# PNGs under Resources/icons are turned into plain .icns files with sips as
# a fallback, so the app still gets an icon.
icon_bundle="${package_dir}/Resources/Reviewer.icon"
icon_build="${package_dir}/.build/icon"
rm -rf "$icon_build" && mkdir -p "${icon_build}/dark" "${icon_build}/Reviewer.icon"

compile_icon() {
  xcrun actool "$1" \
    --compile "$2" \
    --platform macosx \
    --minimum-deployment-target 26.0 \
    --app-icon Reviewer \
    --include-all-app-icons \
    --output-partial-info-plist "${icon_build}/partial.plist" >/dev/null 2>&1
}

png_to_icns() {
  local iconset="${icon_build}/$(basename "$2" .icns).iconset"
  mkdir -p "$iconset"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$1" --out "${iconset}/icon_${size}x${size}.png" >/dev/null
    local double=$((size * 2))
    sips -z "$double" "$double" "$1" --out "${iconset}/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$iconset" -o "$2"
}

if compile_icon "$icon_bundle" "${contents}/Resources"; then
  cp -R "${icon_bundle}/Assets" "${icon_build}/Reviewer.icon/"
  python3 - "${icon_bundle}/icon.json" "${icon_build}/Reviewer.icon/icon.json" <<'PY'
import json, sys
def promote_dark(node):
    if isinstance(node, dict):
        fills = node.get("fill-specializations")
        if fills:
            dark = next((f for f in fills if f.get("appearance") == "dark"), None)
            if dark:
                node["fill-specializations"] = [{"value": dark["value"]}]
        for child in node.values():
            promote_dark(child)
    elif isinstance(node, list):
        for child in node:
            promote_dark(child)
icon = json.load(open(sys.argv[1]))
promote_dark(icon)
json.dump(icon, open(sys.argv[2], "w"), indent=2)
PY
  compile_icon "${icon_build}/Reviewer.icon" "${icon_build}/dark"
  cp "${icon_build}/dark/Reviewer.icns" "${contents}/Resources/Reviewer-dark.icns"
else
  echo "actool unavailable; falling back to the PNG dock icons" >&2
  png_to_icns "${package_dir}/Resources/icons/reviewer-icon-light.png" "${contents}/Resources/Reviewer.icns"
  png_to_icns "${package_dir}/Resources/icons/reviewer-icon-dark.png" "${contents}/Resources/Reviewer-dark.icns"
fi

# The widget extension rides along under Contents/PlugIns, where the system
# looks for an app's extensions: the ReviewerWidget executable in a bundle
# of its own, with the plist that names it a WidgetKit extension. The app
# registers it with the extension system when it launches.
appex="${contents}/PlugIns/ReviewerWidget.appex"
mkdir -p "${appex}/Contents/MacOS"
cp "${bin_dir}/ReviewerWidget" "${appex}/Contents/MacOS/ReviewerWidget"
cp "${package_dir}/Resources/Widget/Info.plist" "${appex}/Contents/Info.plist"

# Ad-hoc sign so the binaries run under the hardened-runtime defaults of a
# modern macOS without a "damaged app" dialog on first launch — the
# extension first, since the app's signature seals what it holds. Both
# carry their entitlements: the extension runs sandboxed, and the app group
# the two share is where the widget's project feed is written.
codesign --force --sign - \
  --entitlements "${package_dir}/Resources/Widget/ReviewerWidget.entitlements" \
  "$appex" >/dev/null 2>&1 || true
codesign --force --sign - \
  --entitlements "${package_dir}/Resources/Reviewer.entitlements" \
  "$app" >/dev/null 2>&1 || true

# The bundle is torn down and rebuilt on every call, which leaves the system
# holding a registration for a path that no longer exists: Launch Services
# stops resolving the app (and with it the `reviewer://` scheme), and the
# widget host loses the extension — "Unable to find ... extension directly",
# with the placed widgets left on their last drawing. Registering both again
# here is what an install would do, and keeps a rebuilt bundle whole.
lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
"$lsregister" -f "$app" >/dev/null 2>&1 || true
pluginkit -a "$appex" >/dev/null 2>&1 || true

echo "$app"
