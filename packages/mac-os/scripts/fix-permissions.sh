#!/usr/bin/env bash
# Run this when macOS keeps asking Reviewer for privacy grants it has
# already been given on every launch.
#
# A grant is held against the app's code signature: ad-hoc signed that
# signature changes with every `swift build`, so every answer is thrown
# away and every dialog comes back. This makes sure the bundle is signed
# with the stable "Reviewer Dev" identity, clears the stale grants left
# behind by the ad-hoc builds and relaunches, so the next answer is the
# last one.
#
# It also throws away the feed the old builds left in the widget
# extension's sandbox container. That copy, and the group container the
# app looked into for the other one, are both app data as macOS counts it,
# and asking for either is what raised "Reviewer would like to access data
# from other apps"; the feed goes to ~/.reviewer now (see ProjectFeed),
# which asks nothing of anybody, and nothing reads the old one. Deleting
# it reaches into that container, so the terminal running this may be
# asked for the access itself, once.
set -euo pipefail

package_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$package_dir"

bundle_id="com.byconvo.reviewer.macos"
app="${package_dir}/.build/Reviewer.app"
identity="Reviewer Dev"

echo "→ signing identity"
"${package_dir}/scripts/create-signing-identity.sh" "$identity"

echo "→ rebuilding and signing Reviewer.app"
swift build
scripts/bundle.sh debug >/dev/null

signature="$(codesign -dv "$app" 2>&1 | sed -n 's/^Signature=//p')"
if [[ "$signature" == "adhoc" ]]; then
  echo "✗ still ad-hoc signed — codesign could not use \"$identity\"."
  echo "  Open Keychain Access → login → My Certificates → \"$identity\" → Trust → Code Signing: Always Trust, then rerun."
  exit 1
fi

echo "→ clearing stale grants for $bundle_id"
tccutil reset SystemPolicyAppData "$bundle_id" >/dev/null 2>&1 || true

echo "→ removing the feed the old builds left in the widget's container"
rm -f "$HOME/Library/Containers/${bundle_id}.widget/Data/Library/Application Support/projects.json"

echo "→ relaunching"
pkill -f "$app" 2>/dev/null || true
sleep 0.5
open "$app"

cat <<MSG
✓ Reviewer.app is signed with "$identity" and its old grants are cleared.
  From here a rebuild keeps the same signature, so an answer given once
  is kept.
MSG
