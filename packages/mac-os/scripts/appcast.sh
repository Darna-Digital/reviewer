#!/usr/bin/env bash
# Write the Sparkle feed for one release: an appcast.xml naming the disk image
# scripts/release.sh made, signed with the EdDSA key whose public half is
# Info.plist's SUPublicEDKey. release.yml attaches it to the GitHub release
# beside the image, and the app reads the latest release's copy (SUFeedURL).
#
#   SPARKLE_PRIVATE_KEY=… scripts/appcast.sh <dmg> <release-notes.md> <download-url>
#
# Without SPARKLE_PRIVATE_KEY the key is read from the "reviewer" account in
# the login keychain, where `generate_keys --account reviewer` keeps it.
# sign_update comes with the Sparkle package, so a `swift build` (in
# SCRATCH_PATH, default .build) has to have resolved it first.
#
# Prints the feed on stdout.
set -euo pipefail

dmg="${1:?usage: appcast.sh <dmg> <release-notes.md> <download-url>}"
notes="${2:?usage: appcast.sh <dmg> <release-notes.md> <download-url>}"
url="${3:?usage: appcast.sh <dmg> <release-notes.md> <download-url>}"

package_dir="$(cd "$(dirname "$0")/.." && pwd)"
sign_update="${package_dir}/${SCRATCH_PATH:-.build}/artifacts/sparkle/Sparkle/bin/sign_update"
version="${VERSION:-$(node -p "require('${package_dir}/../../package.json').version")}"
minimum_system="$(/usr/libexec/PlistBuddy -c "Print :LSMinimumSystemVersion" "${package_dir}/Resources/Info.plist")"

if [[ -n "${SPARKLE_PRIVATE_KEY:-}" ]]; then
  signature="$(printf '%s' "$SPARKLE_PRIVATE_KEY" | "$sign_update" --ed-key-file - -p "$dmg")"
else
  signature="$("$sign_update" --account reviewer -p "$dmg")"
fi
length="$(stat -f %z "$dmg")"

# The notes go in a CDATA section, which a literal "]]>" would end early.
description="$(sed 's/]]>/]]]]><![CDATA[>/g' "$notes")"

cat <<XML
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Reviewer</title>
    <item>
      <title>Reviewer ${version}</title>
      <pubDate>$(LC_ALL=C date -u "+%a, %d %b %Y %H:%M:%S +0000")</pubDate>
      <sparkle:version>${version}</sparkle:version>
      <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>${minimum_system}</sparkle:minimumSystemVersion>
      <sparkle:hardwareRequirements>arm64</sparkle:hardwareRequirements>
      <description sparkle:format="markdown"><![CDATA[
${description}
]]></description>
      <enclosure url="${url}" type="application/octet-stream" length="${length}" sparkle:edSignature="${signature}"/>
    </item>
  </channel>
</rss>
XML
