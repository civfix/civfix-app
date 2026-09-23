# community-mobile

The civfix community user app: React Native + Expo (custom dev client) + expo-router + TypeScript. It
lives in the `civfix-app` monorepo alongside the web app and the two shared packages it consumes.

## Layout

```
civfix-app/
  apps/community-mobile/    this app (Expo, expo-router)
  apps/community-web/       the public web app (shares @civfix/ui with this app)
  packages/shared/          @civfix/shared - the contract (schemas, types, API client, tokens)
  packages/ui/              @civfix/ui - the shared React Native UI
  pnpm-workspace.yaml       packages: ["apps/*", "packages/*"]
  .npmrc                    node-linker=hoisted (Metro-friendly) + @civfix:registry (for the contract)
```

`@civfix/shared` and `@civfix/ui` are workspace packages (`"workspace:*"` in this app's
`package.json`), not registry installs. See "pnpm + Expo + the shared packages" below.

`apps/community-mobile/.npmrc` mirrors the workspace root's: EAS Build and `expo install` read npm
config from this app directory, and `node-linker=hoisted` is the layout Metro, the config plugins and
CocoaPods are proven on.

## Key versions

| Package | Version | Notes |
| --- | --- | --- |
| expo | ~54.0.36 | SDK 54 |
| react-native | 0.81.5 | SDK 54 pin |
| react / react-dom | 19.1.0 | SDK 54 pin |
| expo-router | ~6.0.24 | file-based routing |
| react-native-reanimated | ~4.1.1 | SDK 54 bundles v4 (see note below) |
| react-native-worklets | 0.5.1 | worklet runtime + Babel plugin for Reanimated v4 |
| react-native-gesture-handler | ~2.28.0 | |
| @gorhom/bottom-sheet | ^5.2.14 | works with Reanimated v4 |
| @maplibre/maplibre-react-native | ^11.3.0 | map; requires RN >= 0.80 (OK on SDK 54) |
| react-native-svg | 15.12.1 | teardrop pins, avatars |
| react-native-safe-area-context | ~5.6.0 | |
| react-native-mmkv | ^3.3.3 | v3 (no Nitro); see "Pinned library majors" |
| react-native-vision-camera | ^4.7.3 | v4 (pre-Nitro); see "Pinned library majors" |
| @tanstack/react-query / zustand | ^5 / ^5 | data + state |

### Reanimated v4

Expo SDK 54 bundles **Reanimated v4**, which moved the worklet Babel transform into the separate
`react-native-worklets` package, so `babel.config.js` uses `react-native-worklets/plugin` (last in the
plugin list), not `react-native-reanimated/plugin`. Reanimated v3 is unsupported on SDK 54 (RN 0.81,
new architecture) and breaks expo-doctor and `@gorhom/bottom-sheet` v5's worklet expectations.

## Building (REQUIRES a dev client - not Expo Go)

This app uses native modules that are not in the Expo Go runtime: MapLibre, Reanimated v4 worklets,
gesture-handler, vision-camera, MMKV, video, Google sign-in, Apple authentication. You MUST build a
custom dev client on a machine with the native toolchains (macOS for iOS; Android SDK for Android):

```sh
pnpm install                            # postinstall builds @civfix/shared's dist
pnpm --filter community-mobile exec expo prebuild
pnpm --filter community-mobile exec expo run:ios      # or run:android
# or: eas build --profile development
```

Then start the bundler with `pnpm --filter community-mobile start` (runs `expo start --dev-client`).

## Store-distribution profiles: `testflight` vs `production`

Two store-distribution profiles exist in `apps/community-mobile/eas.json`, differing only in the
baked API base URL and their EAS Update channel:

- `testflight` - dev/testing builds for TestFlight. Bakes
  `EXPO_PUBLIC_API_URL=https://api.civfix.dev`, so testers hit the staging API. Update channel
  `testflight`.
- `production` - official App Store releases. Sets no `EXPO_PUBLIC_API_URL`, so the base URL is
  chosen at RUNTIME by install source: `https://api.civfix.dev` while that build is handed out
  through TestFlight, `https://api.civfix.org` once the same build is downloaded from the App Store
  (`src/lib/apiUrl.ts`, `src/lib/nativeBetaInstall.ts`). Update channel `production`.

### How the runtime split is decided (iOS only)

**This split exists on iOS and nowhere else.** `src/lib/nativeBetaInstall.ts` returns `false` for any
other platform, so an Android release build - including one handed to internal-track testers - always
resolves to the production API. Android's own testing tracks have no equivalent on-device marker.

iOS ships the App Store and TestFlight copies of a build with different StoreKit receipts: a store
download gets `StoreKit/receipt` in the app's data container, a TestFlight install gets
`StoreKit/sandboxReceipt`. `src/lib/nativeBetaInstall.ts` reads those two paths synchronously through
`expo-file-system`, so `API_URL` is a plain module constant and one session can never straddle two
APIs. `expo-application`'s `getIosApplicationReleaseTypeAsync()` cannot make this call: it reads the
embedded provisioning profile, which reports `APP_STORE` for TestFlight and App Store alike.

Precedence is `EXPO_PUBLIC_API_URL` (when baked) -> `__DEV__` localhost -> the receipt probe.

**Both receipts can be on disk at once.** Moving between TestFlight and the App Store is an in-place
update and the previous receipt is not removed, so mere presence decides nothing: the **newer** file
wins (`src/lib/storeKitReceipt.ts`). Everything ambiguous resolves to production - no sandbox receipt,
a tie, an unreadable modification time, an unreadable container, a probe that throws: all `false`. A
store download therefore cannot be routed to staging by any failure mode of this probe.

**The container path is an assumption.** The probe reconstructs `Bundle.main.appStoreReceiptURL` as
`<data container>/StoreKit/<name>`, derived from `Paths.document.parentDirectory`. If Apple ever
changes that layout the probe goes permanently `false` - production for everyone, which is the safe
direction but silent. A dev build logs the resolved container and both receipt stats under
`[install-source]` so the assumption can be checked on a real device.

**Identity-bearing state is scoped to the API it was written against** (`src/lib/storageScope.ts`).
Four ids carry the API host as a suffix: the app MMKV instance (`civfix.app` - cached user, last
identity, persisted query cache, prefs), the session token in the keychain
(`civfix.session.token`), the secure-blob MMKV instance (`civfix.secure`) and its keychain encryption
key (`civfix.secure-blobs.key`). Production deliberately keeps the legacy un-suffixed ids so existing
App Store users are not signed out by this change.

Three stores are deliberately NOT scoped, because none of them holds identity or server state: the map
filter prefs including recent-search history (`civfix.ui.filters`, `@civfix/ui`
`map/filterStorage.native.ts`), the sidebar width (`civfix.ui.sidebar`,
`shell/sidebarStorage.native.ts`), and the push `device_id` (`civfix.device_id`, `src/lib/deviceId.ts`),
which must stay stable per install for the backend's push-token ownership guard to recognise a
same-device handoff.

**Scoping alone does not protect the TestFlight -> App Store upgrade**, and that is the whole point of
`src/lib/storageEnvMarker.ts` + `src/lib/legacyStorageReset.ts`. Production resolves to the LEGACY ids,
so a prod build cannot tell its own leftovers from a pre-namespacing TestFlight install's staging
leftovers sitting under the same ids. Every run therefore records its environment in an unscoped
keychain item (`civfix.storage.env`), and `adoptStorageEnvironment()` runs at boot before the first
session read: on a production boot whose marker names a non-production environment, it clears the four
legacy ids (the blob encryption key is emptied through its own store rather than deleted, so an
already-open MMKV instance is never re-keyed mid-process) and the in-memory query cache. The marker
lives in the keychain, not MMKV, because the keychain is where the dangerous leftover survives an app
DELETE - so delete-and-reinstall into the App Store copy is covered too.

*What it cannot detect:* the FIRST upgrade off a build that predates the marker. There the marker is
absent, and an absent marker beside a legacy session token is genuinely ambiguous - equally a
long-standing App Store user whose session is legitimately theirs. Signing all of those out is the
worse failure, so an absent marker keeps the state: that one upgrade still sends a staging token to
prod, is rejected with a 401 and signs out, after briefly painting the cached staging user. Every later
environment flip on that install is covered, because by then a marker exists. Note also that a purge
clears `civfix.app` wholesale, so the locale, theme and onboarding-seen prefs of the discarded
environment go with it.

**Share links do not follow the split.** `app.config.js` `ios.associatedDomains` pins
`applinks:civfix.org` / `applinks:www.civfix.org` only, so a `civfix.dev` link produced by a
staging-resolved build opens in the browser rather than deep-linking into the app. Universal links
work only against the production domain; adding `civfix.dev` would need a new entitlement and a
matching apple-app-site-association file on that host.

**App Review runs against staging.** A reviewer's copy is installed through the beta/sandbox path, so
the probe returns `true` and review sessions hit `api.civfix.dev`. That is a deliberate, recorded
property - see the "Environment" section of `APP-REVIEW-NOTES.md` and its pre-submission checklist.

### Hand-driven Xcode archive (`scripts/prep-archive.sh`)

**`eas.json` build profiles are read by `eas build` only.** A raw Xcode archive never sees them, so
archiving straight out of Xcode ignores the split above entirely. What an Xcode build *does* read is
`.env`: the "Bundle React Native code and images" phase runs `expo export:embed` (which inlines
`EXPO_PUBLIC_*` into the JS bundle) and the expo-constants pod phase runs `getAppConfig.js`, which
calls `@expo/env`.load() before serialising the app config into `EXConstants.bundle`. Both therefore
read `.env` at *archive* time.

So prep the native project with the target's `.env` in place, then archive by hand:

```sh
pnpm --filter community-mobile prep:testflight   # -> bakes https://api.civfix.dev
pnpm --filter community-mobile prep:appstore     # -> bakes NOTHING; resolved at runtime
apps/community-mobile/scripts/prep-archive.sh appstore --platform android
```

It runs `pnpm install --frozen-lockfile`, writes `.env`, re-runs `expo prebuild` + `pod install`,
clears the Metro cache, then prints the config it actually produced (API URL, build number, update
channel, signing team, and the `@civfix/ui` / `@civfix/shared` versions on disk) and fails rather than leave you with a mis-baked project.

The lockfile sync matters because an Xcode archive bundles JS straight out of `node_modules` and
nothing else in the pipeline notices when a third-party dependency there is stale. Then: open
`ios/civfix.xcworkspace`, destination **Any iOS Device (arm64)**, **Product > Archive**,
**Distribute App > App Store Connect**.

Two things this script exists to stop:

- `.env` is gitignored and *persists*. A `testflight` prep would otherwise silently govern every
  later local build on that machine. The script **rewrites `.env` on every run**, so the `appstore`
  target's omission of `EXPO_PUBLIC_API_URL` is a real omission and not a leftover - and the banner
  refuses to let you archive unless the built config carries **no `apiUrl` at all**. Baking one there
  would freeze the runtime split to a single API. Re-run the script before switching targets.
- `expo prebuild` deletes `DEVELOPMENT_TEAM` from the pbxproj on every run unless `ios.appleTeamId`
  is set, so a team picked by hand in Xcode's Signing & Capabilities pane vanishes on the next
  prebuild. The script reads the existing team back out and feeds it in via `CIVFIX_APPLE_TEAM_ID`.

**Close the workspace in Xcode before running it.** Rewriting `project.pbxproj` under a running
Xcode leaves its build service on a stale project graph, and the next build dies instantly with
`Could not compute dependency graph: MsgHandlingError(message: "unable to initiate PIF transfer
session (operation in progress?)")`. The project on disk is fine; only Xcode's session is stale.
Recover with `pkill -x SWBBuildService` (`XCBBuildService` on older Xcode; Xcode respawns it), then
a full Xcode quit + reopen, then `rm -rf ~/Library/Developer/Xcode/DerivedData/civfix-*`.

Unlike an EAS build, a local archive has no update channel of its own - EAS injects that from
eas.json. `CIVFIX_UPDATE_CHANNEL` (also set by the script) fills that gap via
`updates.requestHeaders`, so a hand-built TestFlight binary can't be pulled onto the prod API by an
OTA update. The local build number comes from `ios.buildNumber` in `app.config.js` (EAS's remote
`autoIncrement` counter does not apply) and must exceed every build already in App Store Connect.

### Android release build (gradle)

Android ships by hand from this directory: prep the target, re-apply the machine-local gradle pieces
`expo prebuild` wipes, then build with JDK 22 (the Gradle 8.14.3 wrapper cannot use the default
Temurin 25).

```sh
scripts/prep-archive.sh testflight --platform android   # or appstore; Android always resolves to https://api.civfix.org
scripts/android-release-patches.sh
export JAVA_HOME="$(/usr/libexec/java_home -v 22)"
cd android && ./gradlew --no-daemon :app:assembleRelease   # or :app:bundleRelease for the Play .aab
```

`android.versionCode` in `app.config.js` is the source of truth for the Play version code and must be
bumped in a PR for every Play upload, never by editing `android/`, which is gitignored and
regenerated by the prebuild, so a hand edit there is invisible to the next person and to CI.

### Launch screen assets are baked at prebuild

`ios/` and `android/` are gitignored, so the native launch screen is **whatever the last local
prebuild generated**, not what `assets/` and `app.config.js` currently say. `expo-splash-screen`
copies `assets/splash.png` into
`ios/civfix/Images.xcassets/SplashScreenLogo.imageset/image@{1,2,3}x.png` and writes
the paper background into the storyboard; nothing re-checks either afterwards. A stale prebuild
therefore ships the *old* logo on the *new* background, which is how an opaque splash asset from
an earlier revision shipped a visible box around the logo in both appearances long after
`assets/splash.png` had been fixed.

After changing any of these, re-run the prebuild before you archive:

- `assets/splash.png` (or any other native asset: icon, adaptive icon)
- the `splash` / `expo-splash-screen` blocks in `app.config.js`
- the paper token in `@civfix/shared` that `SPLASH_BG_LIGHT` derives from

```sh
cd apps/community-mobile
npx expo prebuild --platform ios --clean --no-install
(cd ios && pod install)
```

`scripts/prep-archive.sh` runs a (non-`--clean`) prebuild + `pod install`, so a prep'd archive picks
the change up; a hand-run `expo run:ios` or an Xcode archive against an existing `ios/` does not.
Use `--clean` when you want the native project regenerated from scratch rather than re-synced in
place: it is the only way to be sure no earlier generated file survives.

The launch screen is light-only, by product decision (2026-09-14): the static native screen and the
JS wordmark screen that follows it are both painted on light paper in every appearance, so the two
match instead of one switching a beat before the other. That is why `app.config.js` carries no `dark`
splash block (not on `splash`, not on the `expo-splash-screen` plugin tuple), and why
`src/boot/launchTheme.ts` pins `LAUNCH_SCHEME` to `light` for `LoadingSplash`, `BootOfflineGate`, the
pre-fonts backdrop in `app/_layout.tsx` and that file's system chrome: while `gateMounted` is true,
`RootStack` holds the status bar, the Android nav-bar glyphs and the native root background
(`SystemUI.setBackgroundColorAsync`) on the launch scheme, so none of them turns dark behind the
light gate. The app proper is unaffected: `userInterfaceStyle` stays `automatic` and every shell
frame once the gate has unmounted follows the device.

There is no dark variant of the artwork and none is needed. `assets/splash.png` is the wordmark on a
fully transparent canvas; what sits behind it is `SPLASH_BG_LIGHT`, which the prebuild writes into
`ios/civfix/Images.xcassets/SplashScreenBackground.colorset` as a single `universal` entry with no
`luminosity` appearance, and the storyboard paints its container view with that colorset *by name*
(`<color key="backgroundColor" name="SplashScreenBackground"/>`). With one appearance in the
colorset UIKit resolves the same paper in light and dark. `Info.plist` still keeps
`UIUserInterfaceStyle` at `Automatic`: that key governs the whole process, launch screen included,
so forcing `userInterfaceStyle` to `light` in `app.config.js` would hold the splash light too, but it
would pin the app proper to that one appearance along with it. The single-appearance colorset buys
the same launch paper without that cost.

`tests/splashAsset.test.ts` guards this. It decodes `assets/splash.png` and asserts the corners are
fully transparent and that most of the image is, and (when a local `ios/` prebuild exists) decodes
the generated `@3x` imageset entry and asserts the same, checks that the colorset holds exactly one
light appearance, that the imageset lists no dark entry and no `dark_image` file survives on disk,
that the storyboard binds the named colour, and that `Info.plist` keeps `Automatic`, so a stale
prebuild carrying the old two-appearance splash fails the test suite before anyone archives. CI has
no `ios/`, so that half simply skips there.

iOS also caches the rendered launch screen as a snapshot, and that snapshot outlives the build it
came from: a simulator that has been shown the old splash keeps replaying it after `simctl uninstall`
+ reinstall and after a full simulator reboot, even though the freshly installed `Assets.car`
demonstrably holds the new colours. So a local "the fix didn't work" is usually the snapshot, not the
binary; verify the bundle with `xcrun assetutil --info <app>/Assets.car` before believing the
screen, and bump `ios.buildNumber` (or use a fresh simulator) to force a re-render.

### Local `eas build` (`scripts/store-build.sh`)

`apps/community-mobile/scripts/store-build.sh` wraps the whole local flow - it builds the ipa on
this Mac with `eas build --local` (which, unlike a raw Xcode archive, applies the profile's env so
the right API URL is baked in) and then runs `scripts/store-upload.sh`, which uploads the ipa
straight to App Store Connect with `fastlane pilot upload`, not `eas submit`, whose free-tier
queue can hold a submission for hours:

```sh
pnpm --filter community-mobile build:testflight   # TestFlight dev build -> staging API
pnpm --filter community-mobile build:appstore     # App Store release build -> prod API
```

One-time prereqs: Xcode + command-line tools, `brew install fastlane`, `npm install -g eas-cli`,
`eas login`, and, to upload, an App Store Connect API key exported as `ASC_KEY_ID`,
`ASC_ISSUER_ID` and `ASC_PRIVATE_KEY` (the `.p8` contents); the script refuses to start a build it
could not upload. Append `--no-submit` (e.g. `pnpm --filter community-mobile build:testflight --
--no-submit`) to just produce the ipa without uploading (the live-version check below still runs
first); the ipa lands in
`apps/community-mobile/build/` (gitignored) unless `--output <path>` says otherwise. After the
build the script reads the resolved config back out of the ipa (`EXConstants.bundle/app.config`)
and refuses to upload one whose baked API URL is not what the profile promises. Cloud equivalent,
if the build doesn't need to happen on your machine: `eas build --platform ios --profile
testflight|production` from `apps/community-mobile`, then `scripts/store-upload.sh <ipa>` against
the downloaded artifact.

### CI (`.github/workflows/deploy-mobile.yml`)

The same script runs on a GitHub-hosted `macos-26` runner, on the same lane as the web deploy:

| Event | Profile | Result |
| --- | --- | --- |
| push to `main` touching `apps/community-mobile/**`, `packages/**` or the root manifests | `testflight` | staging-API build in TestFlight |
| manual run (Actions -> "Deploy mobile (TestFlight)" -> Run workflow, `profile=production`) | `production` | prod-API build uploaded to App Store Connect, nothing submitted for review |

A prod mobile release is a button rather than a `v*` tag on purpose: the app version in
`app.config.js` is not derived from the git tag, and a web-only release must not produce a mobile
build. Every run is a cold build (EAS local builds do no caching) and takes on the order of half an
hour or more; a running build is never cancelled by a newer push, because the remote build number
has already been consumed by then.

What CI needs, none of it in this repository:

- `EXPO_TOKEN` repository secret: an access token for a robot user in the Expo organisation that
  owns the project (`owner` in `app.config.js`), Developer role is enough.
- `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_PRIVATE_KEY` repository secrets: an App Store Connect API
  key made for CI (App Store Connect -> Users and Access -> Integrations -> App Store Connect API,
  Developer role), its Issuer ID, and the full contents of the downloaded `AuthKey_<KEY_ID>.p8`.
  This is what uploads the ipa, in a workflow step of its own so the key is never in scope for
  the build; revoke it there if the repository is ever compromised.
- EAS project credentials for `org.civfix.community` (expo.dev -> Project credentials -> iOS): the
  distribution certificate + App Store provisioning profile, and an App Store Connect API key under
  Service credentials, which EAS uses to manage that signing material (uploads no longer go
  through EAS).
- The remote build number initialised once, above the highest build already in App Store Connect:
  `eas build:version:set -p ios` from this directory. An unset counter is silently seeded from
  `ios.buildNumber` in `app.config.js`, and a number App Store Connect has already seen is only
  rejected at upload time, after the whole build.

The build number is the only version EAS moves. The user-facing version (`version` in
`app.config.js`, mirrored in `package.json`; `CFBundleShortVersionString`) is bumped by hand, and
the moment matters: App Store Connect accepts any number of builds for a version until that version
is approved, then rejects every further upload of it ("You've already submitted this version of the
app"). So **the first PR after an App Store release bumps `version`**: `npm version patch
--no-git-tag-version` in this directory moves `package.json`, then set the same value in
`app.config.js`, or every push to `main` fails at upload time. `scripts/store-build.sh` runs
`scripts/store-version-gate.mjs` before it builds: it reads the live version from Apple's public
lookup API (no credential) and refuses a version that is not strictly above it, so a missed bump
fails in seconds instead of after a half-hour build. The lookup can lag a few hours behind an
approval, and when Apple's endpoint is unreachable the gate warns and lets the build proceed, so in
either case the upload still has the final say. The version is also the
OTA runtime version (`runtimeVersion.policy: appVersion`), so a bump starts a fresh update lineage.

`app.config.js` pins `ios.appleTeamId` to the civfix Apple team (`WMDUV888LH`), so `expo prebuild`
writes that `DEVELOPMENT_TEAM` into the Xcode project. EAS-managed signing overrides it for store
builds and simulator builds ignore it; a developer outside that team who wants a device
`expo run:ios` sets `CIVFIX_APPLE_TEAM_ID` to their own team first.

An `appstore` upload still lands in TestFlight first; the actual App Store release is the manual
App Store Connect step (attach the build to a version, submit for review).

The API URL is baked into the JS bundle at build (or `eas update` publish) time - the separate
update channels are what keep an OTA update from ever moving a build onto the other plane's API.
Both profiles share the remote `autoIncrement` build-number counter, so TestFlight and App Store
submissions stay monotonic. Both also upload to the same App Store Connect app, and App Store
Connect lets you pick ANY uploaded build for review - never select a `testflight`-profile build
number for an App Store release; it has the staging API baked in. If OTA updates are ever enabled
for TestFlight testers, publish the `testflight` channel with
`EXPO_PUBLIC_API_URL=https://api.civfix.dev` set at `eas update` time (profile `env` applies only
to `eas build`), and never map the `testflight` channel onto a prod-published branch.

Config plugins are declared in `apps/community-mobile/app.config.js`: expo-router,
expo-localization, expo-build-properties, MapLibre, expo-secure-store, Apple authentication,
expo-location, expo-notifications, vision-camera, expo-image-picker, Google sign-in (URL scheme) and
expo-splash-screen. Its `infoPlist` block sets the camera, microphone, location-when-in-use and
photo-library strings; the plugins add the location-always pair (expo-location defaults) and Face ID
(expo-secure-store). The API base
URL comes from `EXPO_PUBLIC_API_URL`, surfaced via `extra.apiUrl`; when unset, dev builds fall back
to `http://localhost:8080` and release builds to whichever API the install source implies -
`https://api.civfix.dev` from TestFlight, `https://api.civfix.org` from the App Store
(`src/lib/apiUrl.ts`).

## Brand assets

Two manual generators produce the committed images (run from `apps/community-mobile`; `sharp` and
`opentype.js` are dev-only tools, installed at the repo root with `--no-save`):

- `node scripts/gen-icon-from-source.mjs [path/to.png]` writes `assets/icon.png` (1024, no alpha, for
  iOS) and `assets/adaptive-icon.png` (Android foreground) from `assets/icon-source.png`, the source
  of truth for the icon art.
- `node scripts/gen-splash.mjs` writes `assets/splash.png`, the transparent "civfix" wordmark.

`expo prebuild` regenerates the native launcher and splash resources from these PNGs.

## pnpm + Expo + the shared packages

- `.npmrc` (root and this app's mirror) sets `node-linker=hoisted` so the store is a flat
  `node_modules` layout - Metro/RN do not handle pnpm's nested symlink store well. `@civfix` is still
  scoped to the private registry (`@civfix:registry=https://repo.civfix.org/`) for the repos outside
  this monorepo; here both packages resolve from the workspace.
- `@civfix/shared` and `@civfix/ui` are `"workspace:*"` dependencies. `@civfix/shared` is consumed
  from its BUILT `dist` (gitignored), so it must be built before Metro or `tsc` can resolve it: this
  app's `postinstall` runs `pnpm --filter @civfix/shared build`, which also covers EAS builders, and
  turbo's `^build` covers it for every root task. Metro resolves the subpath imports
  (`@civfix/shared/tokens`, `/client`) through that package's `exports` map.
- `metro.config.js` is plain `getDefaultConfig(__dirname)` from `expo/metro-config`. Expo's default
  config already discovers the pnpm workspace root (watch folders + `nodeModulesPaths`) and enables
  package exports, so no custom monorepo wiring is needed.
- `eas.json` pins `"pnpm": "9.12.0"` on the build profiles so EAS installs with the same package
  manager as `packageManager` at the workspace root.

Contract changes are made in `packages/shared` and picked up here directly. A contract change still
needs a changeset + `pnpm changeset version` so the OUT-OF-REPO consumers (civfix-backend,
civfix-admin, the gov plane) can adopt the published version - see the repo-root `RELEASING.md`.

## Shared UI (`@civfix/ui`)

Most user-facing screens live in `@civfix/ui` (`packages/ui`), the shared React Native UI consumed by
both this app and `community-web` (web renders it via react-native-web). The same `.tsx` is authored
once and the layout adapts to orientation and width, not to platform: a landscape window at least
`EXPANDED_MIN_WIDTH` wide gets the expanded sidebar shell, every other window (portrait, or landscape
too narrow for the chrome) the compact bottom-sheet shell (`useLayoutMode` in
`packages/ui/src/theme/useLayoutMode.ts`, deciding through `layoutModeFor` in
`packages/ui/src/shell/expandedFramePlan.ts`). This app stays the native host: it provides the data
context (Bearer auth, the API client, the chat WebSocket), the platform capabilities (vision-camera,
geolocation, secure-store, push, haptics, expo-blur, clipboard, calendar file, open-external), MMKV
persistence, the maplibre-react-native map, and the `expo-router` deep-link adapter
(`src/lib/navBridge.ts`). The native shell (animated splash, onboarding, push registration,
`civfix://` and universal-link deep links) injects those into the shared UI; sign-in is required per
action through `useAuthGate`, so guests can browse. `packages/ui/README.md` covers the
architecture (the five seams) and the authoring rules.

`@civfix/ui` ships untranspiled `.tsx` SOURCE (not a bundle) and emits only `.d.ts`. Metro consumes
the source directly: it honors the package's `react-native` export condition, so the `.native.tsx`
side of each platform seam (expo-*, native maplibre, gorhom sheet, reanimated, video) wins on device.
No `@civfix/ui` build step is needed for Metro to bundle it.

`@civfix/ui` is a `workspace:*` dependency and is never published, so there is no override to add and
no version to adopt: edit `packages/ui/src` and Metro picks it up on the next reload. `tsc`, however,
typechecks against `@civfix/ui`'s `dist-types`, so a mobile typecheck needs those declarations
rebuilt first - turbo does that automatically (`typecheck` dependsOn `^build`), which is why
`pnpm typecheck` from the repo root is the reliable form. Verify a single React Native with
`pnpm why react-native` (expect exactly one).

## Design tokens -> RN theme

The RN theme lives in `@civfix/ui/theme`, which adapts the shared tokens (`@civfix/shared/tokens`)
into RN values. `src/theme/index.ts` re-exports it (so `@/theme` imports keep working) and adds only
the wordmark letters. Do not hardcode hex/size values in components; import from the theme.

## Map basemap (decision)

- **The map ALWAYS uses the hardcoded CARTO raster basemap**: Voyager in light, Dark Matter in dark,
  defined once in `packages/ui/src/map/mapStyle.ts` and shared with the web app. The tile URLs and
  attribution are hardcoded, so the map needs nothing from the backend to render and the app does not
  call `GET /map/tileinfo`. The public CARTO key (`EXPO_PUBLIC_CARTO_API_KEY`, which `app.config.js`
  defaults and surfaces through `extra`) is appended to the tile URLs; a blank key leaves them
  untouched. There is no PMTiles dependency.

### Onboarding map stills

The first-run tour's map cards (`src/components/onboarding/stages/MapStill.tsx`) are CARTO Voyager
(light) / Dark Matter (dark) crops of three real Los Angeles places: Highland Park (report), Boyle
Heights at Hollenbeck Park (track), Echo Park Lake (together). They ship as static `@2x` PNGs in
`assets/onboarding/` so first launch needs no network, with `@civfix/ui` pins overlaid at real
coordinates by the stages. `node scripts/onboarding-map-art.mjs` regenerates them from the scene table
in `src/components/onboarding/onboardingMapScenes.ts` through the app's own tile URL rule and CARTO
key, writes the palettised stills plus a `manifest.json` (sha256, dimensions and the scene centre,
zoom and point size each still was cut from) that `tests/onboardingMapArt.test.ts` asserts against
(so editing a scene without regenerating fails the suite), and with `--preview <dir>` also writes
copies with the pin spots marked for checking the framing after moving a scene.

## Pinned library majors

- **react-native-mmkv** is pinned to v3 (not v4) and **react-native-vision-camera** to v4 (not v5)
  because the latest majors require `react-native-nitro-modules` + `react-native-nitro-image`, which
  add native-build surface. v3/v4 install, typecheck, pass expo-doctor, and have stable config
  plugins.
- **react-native-video** (media playback in `@civfix/ui`'s `MediaPreview.native`) and
  **react-native-compressor** (capture compression in `src/lib/nativeCamera.ts`) autolink and need
  no config-plugin entry.

## Verify

```sh
pnpm install                                    # postinstall builds @civfix/shared's dist
pnpm turbo run typecheck lint test --filter=community-mobile   # what CI runs (builds the packages first)
pnpm --filter community-mobile exec expo-doctor
pnpm --filter community-mobile exec expo export --platform ios   # JS bundle (no native compile)
```

`.github/workflows/ci.yml` runs exactly that on every PR to `main` (the `community-mobile`
job), plus `npx expo-doctor` from this directory. Deploying is `.github/workflows/deploy-mobile.yml`
(see "CI" above): a merge to `main` puts a staging build in TestFlight; nothing reaches a device
before that workflow, a local `scripts/store-build.sh` run or a hand-driven archive runs.

Launch-screen coverage splits along that line: `tests/splashConfig.test.ts` asserts the resolved
`app.config.js` (automatic appearance for the app, the light paper background, and no `dark` block
anywhere) and `tests/bootTheme.test.ts` asserts the JS boot screen is pinned to the launch scheme,
so both run in CI, while the `ios/` prebuild assertions in `tests/splashAsset.test.ts` skip anywhere
without a local prebuild.
