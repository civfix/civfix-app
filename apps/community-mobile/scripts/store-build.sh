#!/usr/bin/env bash
# Local iOS store build + upload to App Store Connect, wrapping the eas.json profiles:
#
#   scripts/store-build.sh testflight    dev/testing build for TestFlight — staging API (https://api.civfix.dev)
#   scripts/store-build.sh appstore      official App Store release build — prod API (https://api.civfix.org)
#
# Runs `eas build --local` on this Mac. Unlike a raw Xcode archive, this applies the profile's env
# (EXPO_PUBLIC_API_URL), so the right API base URL is baked in. The ipa is then uploaded with
# `eas submit`; it appears in TestFlight once App Store Connect finishes processing. An appstore
# upload additionally needs the manual App Store Connect step: attach the build to a version and
# submit for review — and never pick a testflight-profile build number there.
#
# Pass --no-submit to only produce the ipa (printed path) without uploading.
#
# One-time prereqs: Xcode + command-line tools, `brew install fastlane`, `npm install -g eas-cli`,
# `eas login`. Credentials and the auto-incremented build number come from EAS (remote).
set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  echo "usage: scripts/store-build.sh testflight|appstore [--no-submit]" >&2
  exit 1
}

target="${1:-}"
case "$target" in
  testflight) profile="testflight" ;;
  appstore) profile="production" ;;
  *) usage ;;
esac

submit=1
if [ "${2:-}" = "--no-submit" ]; then
  submit=0
elif [ -n "${2:-}" ]; then
  usage
fi

command -v eas >/dev/null 2>&1 || { echo "eas-cli not found. Install: npm install -g eas-cli" >&2; exit 1; }
command -v fastlane >/dev/null 2>&1 || { echo "fastlane not found (required by local iOS builds). Install: brew install fastlane" >&2; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild not found. Install Xcode + command-line tools." >&2; exit 1; }
eas whoami >/dev/null 2>&1 || { echo "Not logged in to EAS. Run: eas login" >&2; exit 1; }

mkdir -p build
ipa="build/civfix-${target}-$(date +%Y%m%d-%H%M%S).ipa"

echo "Building iOS ipa locally (profile: ${profile}) -> ${ipa}"
eas build --platform ios --profile "$profile" --local --output "$ipa"

if [ "$submit" = 0 ]; then
  echo "Built ${ipa} (profile: ${profile})."
  echo "Upload later with: eas submit --platform ios --profile ${profile} --path ${ipa}"
  exit 0
fi

eas submit --platform ios --profile "$profile" --path "$ipa"
echo "Uploaded ${ipa}. It will show up in TestFlight after App Store Connect processing."
if [ "$profile" = "production" ]; then
  echo "App Store release: in App Store Connect, attach THIS build number to the version and submit for review."
fi
