#!/usr/bin/env bash
# Send a zip, disk image or package through Apple's notary service and wait
# for its verdict. Used for Reviewer.app and its disk image (release.sh) and
# for the TUI's binaries (packages/tui/release/package.sh).
#
# `notarytool submit --wait` can exit non-zero on a rejected submission, and
# the reason is only in the submission's log, so the status is read back from
# its JSON rather than trusted from the exit code.
#
#   APPLE_API_KEY_PATH=AuthKey_XXXX.p8 APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER=<uuid> \
#   scripts/notarize.sh path/to/submission.zip
set -euo pipefail

submission="${1:?usage: notarize.sh <zip|dmg|pkg>}"
: "${APPLE_API_KEY_PATH:?}" "${APPLE_API_KEY_ID:?}" "${APPLE_API_ISSUER:?}"

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
