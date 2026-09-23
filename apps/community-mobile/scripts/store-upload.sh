#!/usr/bin/env bash
# Upload a store-signed ipa straight to App Store Connect with `fastlane pilot upload` — not
# `eas submit`, whose free-tier queue can hold a submission for hours. It appears in TestFlight
# once App Store Connect finishes processing.
#
#   scripts/store-upload.sh <path-to.ipa>
#
# store-build.sh calls this after a build unless --no-submit was given; .github/workflows/
# deploy-mobile.yml runs it as its own step so the Apple key below is in scope for the upload
# only, never for the half-hour build and everything `eas build --local` spawns.
#
# Authenticates with an App Store Connect API key (App Store Connect -> Users and Access ->
# Integrations -> App Store Connect API; Developer role is enough) read from three environment
# variables — GitHub Actions secrets in CI, exported by hand on a laptop:
#   ASC_KEY_ID        the key's Key ID
#   ASC_ISSUER_ID     the Issuer ID shown on that page
#   ASC_PRIVATE_KEY   the full contents of the downloaded AuthKey_<KEY_ID>.p8, BEGIN/END lines included
# The key is written to a 0600 temp file removed when this script exits (fastlane copies it into
# a private temp directory of its own for altool and removes that too); it is never logged.
set -euo pipefail

ipa="${1:-}"
[ -n "$ipa" ] && [ -f "$ipa" ] || { echo "usage: scripts/store-upload.sh <path-to.ipa>" >&2; exit 1; }

command -v fastlane >/dev/null 2>&1 || { echo "fastlane not found. Install: brew install fastlane" >&2; exit 1; }
for var in ASC_KEY_ID ASC_ISSUER_ID ASC_PRIVATE_KEY; do
  [ -n "${!var:-}" ] || { echo "$var is not set. Uploading needs an App Store Connect API key (see the header of this script)." >&2; exit 1; }
done

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export FASTLANE_SKIP_UPDATE_CHECK=1
export FASTLANE_HIDE_CHANGELOG=1

api_key_file="$(mktemp "${TMPDIR:-/tmp}/civfix-asc-key.XXXXXX")"
trap 'rm -f "$api_key_file"' EXIT
chmod 600 "$api_key_file"
node -e '
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env
  process.stdout.write(JSON.stringify({ key_id: ASC_KEY_ID, issuer_id: ASC_ISSUER_ID, key: ASC_PRIVATE_KEY, in_house: false }))
' > "$api_key_file"

fastlane pilot upload --ipa "$ipa" --api_key_path "$api_key_file" --skip_waiting_for_build_processing true
echo "Uploaded ${ipa}. It will show up in TestFlight after App Store Connect processing."
