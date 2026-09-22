#!/usr/bin/env bash
# iOS store build + upload to App Store Connect, wrapping the eas.json build profiles:
#
#   scripts/store-build.sh testflight    dev/testing build for TestFlight — staging API (https://api.civfix.dev)
#   scripts/store-build.sh appstore      official App Store release build — prod API (https://api.civfix.org)
#
# Runs `eas build --local` on this machine — a developer Mac or the macOS GitHub runner that
# .github/workflows/deploy-mobile.yml drives. Unlike a raw Xcode archive, this applies the profile's
# env (EXPO_PUBLIC_API_URL), so the right API base URL is baked in; after the build the script reads
# the config back OUT OF THE IPA and refuses to upload one whose baked API URL is not the profile's.
# The ipa is then handed to scripts/store-upload.sh, which uploads it straight to App Store Connect
# with `fastlane pilot upload` and an App Store Connect API key — not `eas submit`, whose free-tier
# queue can hold a submission for hours. It appears in TestFlight once App Store Connect finishes
# processing. An appstore upload additionally needs the manual App Store Connect step: attach the
# build to a version and submit for review — and never pick a testflight-profile build number there.
#
#   --no-submit        only produce the ipa (printed path) without uploading
#   --output <path>    write the ipa there instead of build/civfix-<target>-<timestamp>.ipa
#
# One-time prereqs: Xcode + command-line tools, `brew install fastlane`, `npm install -g eas-cli`,
# `eas login` (or EXPO_TOKEN in the environment, which is how CI authenticates). Signing credentials
# and the auto-incremented build number come from EAS (remote). Initialise the remote counter once
# with `eas build:version:set -p ios` above the highest build already in App Store Connect: an unset
# counter is silently seeded from app.config.js's ios.buildNumber, and a number App Store Connect
# has already seen is only rejected at upload time, after the whole build.
#
# The upload needs the App Store Connect API key described in scripts/store-upload.sh (ASC_KEY_ID,
# ASC_ISSUER_ID, ASC_PRIVATE_KEY in the environment); it is checked before the build starts so a
# build that could not be uploaded is never spent. CI keeps the key out of the build entirely: it
# runs this script with --no-submit and store-upload.sh as a separate step.
#
# The user-facing version (`version` in app.config.js, CFBundleShortVersionString) is NOT managed by
# EAS: once App Store Connect approves a version, every later upload must carry a strictly higher
# one, and eas-cli's remote counter cannot bump it. So before spending a build this script asks
# Apple's public lookup API which version is live (scripts/store-version-gate.mjs, no credential)
# and refuses a version that is not above it. The lookup can lag a few hours behind an approval
# and an unreachable endpoint only warns; the upload itself remains the authority.
set -euo pipefail

caller_pwd="$PWD"
cd "$(dirname "$0")/.."

usage() {
  echo "usage: scripts/store-build.sh testflight|appstore [--no-submit] [--output <path>]" >&2
  exit 1
}

target="${1:-}"
case "$target" in
  testflight) profile="testflight"; expected_api_url="https://api.civfix.dev" ;;
  appstore) profile="production"; expected_api_url="" ;;
  *) usage ;;
esac
shift

submit=1
ipa=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-submit) submit=0; shift ;;
    --output)
      [ -n "${2:-}" ] || usage
      case "$2" in
        /*) ipa="$2" ;;
        *) ipa="$caller_pwd/$2" ;;
      esac
      shift 2 ;;
    *) usage ;;
  esac
done

command -v eas >/dev/null 2>&1 || { echo "eas-cli not found. Install: npm install -g eas-cli" >&2; exit 1; }
command -v fastlane >/dev/null 2>&1 || { echo "fastlane not found (required by local iOS builds). Install: brew install fastlane" >&2; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild not found. Install Xcode + command-line tools." >&2; exit 1; }
eas whoami >/dev/null 2>&1 || { echo "Not logged in to EAS. Run: eas login (or export EXPO_TOKEN)" >&2; exit 1; }
if [ "$submit" = 1 ]; then
  for var in ASC_KEY_ID ASC_ISSUER_ID ASC_PRIVATE_KEY; do
    [ -n "${!var:-}" ] || { echo "$var is not set. Uploading needs an App Store Connect API key (see scripts/store-upload.sh); pass --no-submit to only build." >&2; exit 1; }
  done
fi

# CocoaPods refuses to run under an ASCII locale, and CI shells start with none.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

eas_flags=()
if [ -n "${CI:-}" ]; then
  eas_flags+=(--non-interactive)
fi

if [ -z "$ipa" ]; then
  mkdir -p build
  ipa="build/civfix-${target}-$(date +%Y%m%d-%H%M%S).ipa"
fi

node scripts/store-version-gate.mjs

echo "Building iOS ipa locally (profile: ${profile}) -> ${ipa}"
eas build --platform ios --profile "$profile" --local --output "$ipa" ${eas_flags[@]+"${eas_flags[@]}"}

# Prove what was baked, from the artifact itself: expo-constants ships the resolved app config
# inside the app bundle, which is exactly what the running app will read.
baked_config="$(unzip -p "$ipa" 'Payload/*.app/EXConstants.bundle/app.config')"
baked_api_url="$(printf '%s' "$baked_config" | node -e '
  const config = JSON.parse(require("fs").readFileSync(0, "utf8"))
  const apiUrl = config.extra?.apiUrl
  process.stdout.write(typeof apiUrl === "string" ? apiUrl : "")
')"
if [ "$baked_api_url" != "$expected_api_url" ]; then
  echo "Baked API URL is '${baked_api_url:-<unset, falls back to https://api.civfix.org>}' but the ${profile} profile promises '${expected_api_url:-<unset, falls back to https://api.civfix.org>}'. Refusing to upload ${ipa}." >&2
  exit 1
fi
build_version="$(unzip -p "$ipa" 'Payload/*.app/Info.plist' | plutil -convert json -o - - | node -e '
  const plist = JSON.parse(require("fs").readFileSync(0, "utf8"))
  process.stdout.write(`${plist.CFBundleShortVersionString} (${plist.CFBundleVersion})`)
')"
echo "Built ${ipa}: version ${build_version}, profile ${profile}, API ${baked_api_url:-https://api.civfix.org (default)}"

if [ "$submit" = 0 ]; then
  echo "Upload later with: scripts/store-upload.sh ${ipa}"
  exit 0
fi

scripts/store-upload.sh "$ipa"
if [ "$profile" = "production" ]; then
  echo "App Store release: in App Store Connect, attach THIS build number to the version and submit for review."
fi
