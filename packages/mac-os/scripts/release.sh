#!/usr/bin/env bash
# Turn a Developer ID–signed Reviewer.app into the notarized, stapled disk
# image a release ships. The app is bundled first by scripts/bundle.sh with a
# "Developer ID Application: …" SIGN_IDENTITY, which is what gives it the
# hardened runtime and secure timestamps notarization insists on.
#
# The app is notarized and stapled on its own before it goes into the image,
# so the copy dragged to /Applications opens without a network round trip to
# Gatekeeper; the image is then signed, notarized and stapled in turn, so
# opening the download raises no prompt either. That is two trips through
# Apple's notary service — minutes each, bar a brand-new team's first.
#
#   SIGN_IDENTITY="Developer ID Application: …" \
#   APPLE_API_KEY_PATH=AuthKey_XXXX.p8 APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER=<uuid> \
#   scripts/release.sh path/to/Reviewer.app path/to/out-dir
#
# Prints the disk image's path on stdout; everything else goes to stderr.
set -euo pipefail

app="${1:?usage: release.sh <Reviewer.app> <out-dir>}"
out_dir="${2:?usage: release.sh <Reviewer.app> <out-dir>}"
: "${SIGN_IDENTITY:?}" "${APPLE_API_KEY_PATH:?}" "${APPLE_API_KEY_ID:?}" "${APPLE_API_ISSUER:?}"

version="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${app}/Contents/Info.plist")"
arch="$(lipo -archs "${app}/Contents/MacOS/Reviewer")"
if [[ "$arch" == *" "* ]]; then arch="universal"; fi
dmg="${out_dir}/Reviewer-${version}-${arch}.dmg"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out_dir"

# `notarytool submit --wait` can exit non-zero on a rejected submission, and
# the reason is only in the submission's log, so the status is read back from
# its JSON rather than trusted from the exit code.
notarize() {
  local submission="$1" status id result
  result="$(xcrun notarytool submit "$submission" \
    --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" \
    --wait --output-format json)" || true
  status="$(plutil -extract status raw -o - - <<<"$result" 2>/dev/null || echo unknown)"
  id="$(plutil -extract id raw -o - - <<<"$result" 2>/dev/null || echo "")"
  echo "notarization of ${submission##*/}: ${status} ${id}" >&2
  if [[ "$status" != "Accepted" ]]; then
    echo "$result" >&2
    if [[ -n "$id" ]]; then
      xcrun notarytool log "$id" \
        --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" >&2 || true
    fi
    exit 1
  fi
}

ditto -c -k --keepParent "$app" "${work}/Reviewer.zip"
notarize "${work}/Reviewer.zip"
xcrun stapler staple "$app" >&2

mkdir -p "${work}/image"
ditto "$app" "${work}/image/Reviewer.app"
ln -s /Applications "${work}/image/Applications"
hdiutil create -volname "Reviewer" -srcfolder "${work}/image" -fs HFS+ -format UDZO -ov "$dmg" >&2
codesign --force --sign "$SIGN_IDENTITY" --timestamp "$dmg"
notarize "$dmg"
xcrun stapler staple "$dmg" >&2

# What a downloader's Mac will ask of both, answered here first.
spctl --assess --type execute --verbose "$app" >&2
spctl --assess --type open --context context:primary-signature --verbose "$dmg" >&2

echo "$dmg"
