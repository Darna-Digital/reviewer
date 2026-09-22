#!/usr/bin/env bash
# Run this when macOS keeps asking whether Reviewer may "access data from
# other apps" on every launch.
#
# The app writes the widget's project feed into the extension's own sandbox
# container (see ProjectFeed.writeURLs), which counts as another app's data,
# so the first launch asks. The grant is held against the app's code
# signature: ad-hoc signed that signature changes with every `swift build`,
# so the answer is thrown away and the dialog comes back. This makes sure
# the bundle is signed with the stable "Reviewer Dev" identity, clears the
# stale grants left behind by the ad-hoc builds and relaunches, so the next
# answer is the last one.
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

# The widget extension carries its own identifier and its own grants.
echo "→ clearing stale grants for $bundle_id"
for target in "$bundle_id" "${bundle_id}.widget"; do
  tccutil reset SystemPolicyAppData "$target" >/dev/null 2>&1 || true
done

echo "→ relaunching"
pkill -f "$app" 2>/dev/null || true
sleep 0.5
open "$app"

cat <<MSG
✓ Reviewer.app is signed with "$identity" and its old grants are cleared.
  Allow the "access data from other apps" dialog once more; from here a
  rebuild keeps the same signature, so it should not ask again.
MSG
