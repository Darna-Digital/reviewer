#!/usr/bin/env bash
# DragProbe as an .app, because of what it needs to be allowed to do.
#
# The probe drives the mouse with CGEvents, which the system takes only from a
# process the user has trusted for Accessibility, and TCC keys that trust to a
# code signature. A bare `swift build` product is ad-hoc signed afresh every
# build, so a grant given to one would be gone by the next one — the same trap
# the app itself sidesteps by signing with the self-signed "Reviewer Dev"
# certificate (see bundle.sh and README § Signing). Signed the same way, the
# probe is trusted once and stays trusted.
#
#   scripts/bundle-probe.sh          # build, bundle and sign
#   .build/DragProbe.app/Contents/MacOS/DragProbe --image ~/photo.jpg --to 756,469
set -euo pipefail

package_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$package_dir"

swift build --product DragProbe
binary="$(swift build --show-bin-path)/DragProbe"
app="${package_dir}/.build/DragProbe.app"

rm -rf "$app"
mkdir -p "${app}/Contents/MacOS"
cp "$binary" "${app}/Contents/MacOS/DragProbe"

cat > "${app}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleExecutable</key>
	<string>DragProbe</string>
	<key>CFBundleIdentifier</key>
	<string>com.byconvo.reviewer.dragprobe</string>
	<key>CFBundleName</key>
	<string>DragProbe</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>LSUIElement</key>
	<true/>
	<key>LSMinimumSystemVersion</key>
	<string>26.0</string>
</dict>
</plist>
PLIST

dev_identity="Reviewer Dev"
if [[ -n "${SIGN_IDENTITY:-}" ]]; then
  sign_identity="$SIGN_IDENTITY"
elif security find-identity -v -p codesigning 2>/dev/null | grep -q "\"${dev_identity}\""; then
  sign_identity="$dev_identity"
else
  sign_identity="-"
  echo "! no \"${dev_identity}\" certificate — signing ad-hoc, and the Accessibility grant will not outlive the next build (scripts/create-signing-identity.sh)" >&2
fi

if ! codesign --force --sign "$sign_identity" "$app"; then
  echo "✗ codesign failed for DragProbe.app with identity \"${sign_identity}\"" >&2
  exit 1
fi

echo "${app} (signed \"${sign_identity}\")"
