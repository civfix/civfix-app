#!/usr/bin/env bash
# Build a release-signed Google Play .aab from a clean prebuild — the same way on a laptop and on the
# Linux runner that .github/workflows/deploy-android.yml drives. No EAS: gradle runs right here.
#
#   scripts/android-build.sh internal     Play internal testing — staging API (https://api.civfix.dev), baked
#   scripts/android-build.sh production   Play production — bakes NO API URL; Android then always resolves
#                                         to https://api.civfix.org (src/lib/apiUrl.ts)
#
#   --output <path>   write the .aab there instead of build/civfix-<target>-<timestamp>.aab
#
# The EXPO_PUBLIC_* values and the update channel come from eas.json (internal = the testflight profile,
# production = the production profile) through scripts/eas-profile-env.mjs, so an Android build and the
# iOS build of the same lane bake the same configuration. `.env` is ignored (EXPO_NO_DOTENV): a file
# left behind by scripts/prep-archive.sh testflight must not leak the staging URL into a production
# build. After the build the script reads the config back OUT OF THE AAB and refuses one whose baked
# API URL is not the target's, and refuses one signed with the debug key.
#
# Needs, in the environment:
#   CIVFIX_ANDROID_VERSION_CODE    the Play version code; when unset it is asked of Play, which needs
#                                  PLAY_SERVICE_ACCOUNT_JSON (scripts/play-publish.mjs)
#   CIVFIX_KEYSTORE_FILE, CIVFIX_KEYSTORE_PASSWORD_FILE, CIVFIX_KEY_ALIAS, CIVFIX_ANDROID_SDK_DIR
#                                  as read by scripts/android-release-patches.sh
# and a JDK the gradle wrapper accepts (17 through 24) as JAVA_HOME or `java` on PATH.
#
# Upload the result with: node scripts/play-publish.mjs upload <aab> --track internal|production
set -euo pipefail

caller_pwd="$PWD"
cd "$(dirname "$0")/.."

usage() {
  echo "usage: scripts/android-build.sh internal|production [--output <path>]" >&2
  exit 1
}

target="${1:-}"
case "$target" in
  internal) profile="testflight"; expected_api_url="https://api.civfix.dev" ;;
  production) profile="production"; expected_api_url="" ;;
  *) usage ;;
esac
shift

aab=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output)
      [ -n "${2:-}" ] || usage
      case "$2" in
        /*) aab="$2" ;;
        *) aab="$caller_pwd/$2" ;;
      esac
      shift 2 ;;
    *) usage ;;
  esac
done

for tool in java keytool unzip python3 node; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool not found on PATH." >&2; exit 1; }
done

if [ -z "$aab" ]; then
  mkdir -p build
  aab="$PWD/build/civfix-${target}-$(date +%Y%m%d-%H%M%S).aab"
fi

unset EXPO_PUBLIC_API_URL CIVFIX_UPDATE_CHANNEL
export EXPO_NO_DOTENV=1
profile_env="$(node scripts/eas-profile-env.mjs "$profile")"
while IFS= read -r line; do
  if [ -n "$line" ]; then export "$line"; fi
done <<<"$profile_env"

if [ -z "${CIVFIX_ANDROID_VERSION_CODE:-}" ]; then
  CIVFIX_ANDROID_VERSION_CODE="$(node scripts/play-publish.mjs next-version-code)"
fi
export CIVFIX_ANDROID_VERSION_CODE

if [ -z "${CI:-}" ]; then
  echo "Syncing node_modules to pnpm-lock.yaml..."
  (cd ../.. && pnpm install --frozen-lockfile)
fi

echo "Regenerating android/ from scratch (expo prebuild --clean, profile ${profile})..."
npx expo prebuild --platform android --clean --no-install
scripts/android-release-patches.sh

echo "Building the release bundle (version code ${CIVFIX_ANDROID_VERSION_CODE})..."
(cd android && ./gradlew --no-daemon :app:bundleRelease)
mkdir -p "$(dirname "$aab")"
cp android/app/build/outputs/bundle/release/app-release.aab "$aab"

# expo-constants embeds the resolved app config as an asset; it is exactly what the app reads at runtime.
config_entry="$(unzip -Z1 "$aab" | grep -E '^base/assets/app\.config$' || true)"
if [ -z "$config_entry" ]; then
  echo "No base/assets/app.config inside ${aab}; cannot prove what was baked. Entries named app.config:" >&2
  unzip -Z1 "$aab" | grep 'app\.config' >&2 || true
  exit 1
fi
baked="$(unzip -p "$aab" "$config_entry" | node -e '
  const config = JSON.parse(require("fs").readFileSync(0, "utf8"))
  const apiUrl = config.extra == null ? undefined : config.extra.apiUrl
  const shown = apiUrl === undefined ? "" : typeof apiUrl === "string" ? apiUrl : JSON.stringify(apiUrl)
  process.stdout.write([shown, config.version, config.android && config.android.versionCode].join("|"))
')"
# "|", not a tab: IFS whitespace would swallow the empty first field of a production build.
IFS='|' read -r baked_api_url baked_version baked_version_code <<<"$baked"
if [ "$baked_api_url" != "$expected_api_url" ]; then
  echo "Baked API URL is '${baked_api_url:-<unset>}' but ${target} promises '${expected_api_url:-<unset>}'. Refusing ${aab}." >&2
  exit 1
fi
if [ "$baked_version_code" != "$CIVFIX_ANDROID_VERSION_CODE" ]; then
  echo "Baked version code is '${baked_version_code}', expected ${CIVFIX_ANDROID_VERSION_CODE}. Refusing ${aab}." >&2
  exit 1
fi
signer="$(keytool -printcert -jarfile "$aab" 2>&1 || true)"
if ! grep -q '^Owner:' <<<"$signer" || grep -q 'CN=Android Debug' <<<"$signer"; then
  echo "${aab} is not signed with the release upload key (keytool: $(head -1 <<<"$signer")). Play would reject it." >&2
  exit 1
fi

echo "Built ${aab}: version ${baked_version} (${baked_version_code}), ${target}, API ${baked_api_url:-resolved at runtime (https://api.civfix.org)}"
echo "Upload with: node scripts/play-publish.mjs upload ${aab} --track ${target}"
