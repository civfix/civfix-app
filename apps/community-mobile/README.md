# community-mobile

The civfix community user app: React Native + Expo (custom dev client) + expo-router + TypeScript. It
lives in the `civfix-app` monorepo alongside the web app and the two shared packages it consumes.

Stack (locked): React Native + Expo (dev client) + expo-router + TypeScript.

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

## Versions chosen

Targeting the current stable Expo SDK with the broadest native-library compatibility.

| Package | Version | Notes |
| --- | --- | --- |
| expo | ~54.0.0 | SDK 54 (current stable line with the widest 3rd-party RN support) |
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
| react-native-mmkv | ^3.3.3 | v3 (no Nitro) for the later chat queue; see "Deferred libs" |
| react-native-vision-camera | ^4.7.3 | v4 (pre-Nitro) for the later report camera |
| @tanstack/react-query / zustand | ^5 / ^5 | data + state |

### Reanimated v3 vs v4

The build brief asked for Reanimated v3 with `react-native-reanimated/plugin`. Every current stable
Expo SDK (54/55/56) bundles **Reanimated v4**, which moved the worklet Babel transform into the
separate `react-native-worklets` package. Forcing v3 onto SDK 54 (RN 0.81, new architecture) is
unsupported and breaks expo-doctor and `@gorhom/bottom-sheet` v5's worklet expectations. We therefore
use the SDK-bundled Reanimated v4 + `react-native-worklets/plugin` (last in babel.config.js). This is
the only configuration that passes expo-doctor cleanly.

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

## Store builds: TestFlight (staging API) vs App Store (prod API)

Two store-distribution profiles exist in `apps/community-mobile/eas.json`, differing only in the
baked API base URL and their EAS Update channel:

- `testflight` - dev/testing builds for TestFlight. Bakes
  `EXPO_PUBLIC_API_URL=https://api.civfix.dev`, so testers hit the staging API. Update channel
  `testflight`.
- `production` - official App Store releases. Sets no `EXPO_PUBLIC_API_URL`,
  so release builds fall back to the prod API `https://api.civfix.org`
  (`src/lib/apiUrl.ts`). Update channel `production`.

### Hand-driven Xcode archive (`scripts/prep-archive.sh`)

**`eas.json` build profiles are read by `eas build` only.** A raw Xcode archive never sees them, so
archiving straight out of Xcode ignores the split above entirely. What an Xcode build *does* read is
`.env`: the "Bundle React Native code and images" phase runs `expo export:embed` (which inlines
`EXPO_PUBLIC_*` into the JS bundle) and the expo-constants pod phase runs `getAppConfig.js`, which
calls `@expo/env`.load() before serialising the app config into `EXConstants.bundle`. Both therefore
read `.env` at *archive* time.

So prep the native project with the target's `.env` in place, then archive by hand:

```sh
pnpm --filter community-mobile prep:testflight   # -> https://api.civfix.dev
pnpm --filter community-mobile prep:appstore     # -> https://api.civfix.org
apps/community-mobile/scripts/prep-archive.sh appstore --platform android
```

It runs `pnpm install --frozen-lockfile`, writes `.env`, re-runs `expo prebuild` + `pod install`,
clears the Metro cache, then prints the config it actually produced (API URL, build number, update
channel, signing team, and the `@civfix/*` versions **resolved on disk**) and fails rather than
leave you with a mis-baked project.

The lockfile sync is not ceremony. **An Xcode archive bundles JS straight out of `node_modules`, and
nothing else in the pipeline notices when that is stale.** On 2026-08-11 `pnpm-lock.yaml` and
`package.json` both said `@civfix/ui` 0.51.1 while `node_modules` still held 0.50.0 — `pnpm install`
had never been run after the bump commit. Typecheck and all 222 tests went green because they
resolve that same stale copy, so the only symptom would have been a TestFlight build missing the
last two days of UI fixes. Always trust the resolved-version line in the banner over `package.json`.
That exact drift can no longer happen now that `@civfix/shared` and `@civfix/ui` are workspace
packages (the archive bundles the live source / the freshly built `dist`), but the sync still matters
for every third-party dependency. Then: open `ios/civfix.xcworkspace`, destination **Any iOS Device (arm64)**,
**Product > Archive**, **Distribute App > App Store Connect**.

Two things this script exists to stop:

- `.env` is gitignored and *persists*. A `testflight` prep silently governs every later local build
  on that machine, so the `appstore` target writes `https://api.civfix.org` **explicitly** rather
  than leaning on the fallback in `src/lib/apiUrl.ts`. Re-run the script before switching targets.
- `expo prebuild` deletes `DEVELOPMENT_TEAM` from the pbxproj on every run unless `ios.appleTeamId`
  is set, so a team picked by hand in Xcode's Signing & Capabilities pane vanishes on the next
  prebuild. The script reads the existing team back out and feeds it in via `CIVFIX_APPLE_TEAM_ID`.

**Close the workspace in Xcode before running it.** Rewriting `project.pbxproj` under a running
Xcode leaves its build service on a stale project graph, and the next build dies instantly with
`Could not compute dependency graph: MsgHandlingError(message: "unable to initiate PIF transfer
session (operation in progress?)")`. The project on disk is fine — only Xcode's session is stale.
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
scripts/prep-archive.sh testflight --platform android   # or appstore -> https://api.civfix.org
scripts/android-release-patches.sh
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-22.jdk/Contents/Home
cd android && ./gradlew --no-daemon :app:assembleRelease   # or :app:bundleRelease for the Play .aab
```

`android.versionCode` in `app.config.js` is the source of truth for the Play version code and must be
bumped in a PR for every Play upload — never by editing `android/`, which is gitignored and
regenerated by the prebuild, so a hand edit there is invisible to the next person and to CI.

### Launch screen assets are baked at prebuild

`ios/` and `android/` are gitignored, so the native launch screen is **whatever the last local
prebuild generated**, not what `assets/` and `app.config.js` currently say. `expo-splash-screen`
copies `assets/splash.png` into
`ios/civfix/Images.xcassets/SplashScreenLogo.imageset/image@{1,2,3}x.png` and writes
the paper background into the storyboard; nothing re-checks either afterwards. A stale prebuild
therefore ships the *old* logo on the *new* background — which is how an opaque splash asset from
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
place — it is the only way to be sure no earlier generated file survives.

The launch screen is light-only, by product decision (2026-09-14): the static native screen and the
JS wordmark screen that follows it are both painted on light paper in every appearance, so the two
match instead of one switching a beat before the other. That is why `app.config.js` carries no `dark`
splash block — not on `splash`, not on the `expo-splash-screen` plugin tuple — and why
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
`UIUserInterfaceStyle` at `Automatic` — that key governs the whole process, launch screen included,
so forcing `userInterfaceStyle` to `light` in `app.config.js` would hold the splash light too, but it
would pin the app proper to that one appearance along with it. The single-appearance colorset buys
the same launch paper without that cost.

`tests/splashAsset.test.ts` guards this. It decodes `assets/splash.png` and asserts the corners are
fully transparent and that most of the image is, and — when a local `ios/` prebuild exists — decodes
the generated `@3x` imageset entry and asserts the same, checks that the colorset holds exactly one
light appearance, that the imageset lists no dark entry and no `dark_image` file survives on disk,
that the storyboard binds the named colour, and that `Info.plist` keeps `Automatic` — so a stale
prebuild carrying the old two-appearance splash fails the test suite before anyone archives. CI has
no `ios/`, so that half simply skips there.

iOS also caches the rendered launch screen as a snapshot, and that snapshot outlives the build it
came from: a simulator that has been shown the old splash keeps replaying it after `simctl uninstall`
+ reinstall and after a full simulator reboot, even though the freshly installed `Assets.car`
demonstrably holds the new colours. So a local "the fix didn't work" is usually the snapshot, not the
binary — verify the bundle with `xcrun assetutil --info <app>/Assets.car` before believing the
screen, and bump `ios.buildNumber` (or use a fresh simulator) to force a re-render.

### Local `eas build` (`scripts/store-build.sh`)

`apps/community-mobile/scripts/store-build.sh` wraps the whole local flow - it builds the ipa on
this Mac with `eas build --local` (which, unlike a raw Xcode archive, applies the profile's env so
the right API URL is baked in) and uploads it with `eas submit`:

```sh
pnpm --filter community-mobile build:testflight   # TestFlight dev build -> staging API
pnpm --filter community-mobile build:appstore     # App Store release build -> prod API
```

One-time prereqs: Xcode + command-line tools, `brew install fastlane`, `npm install -g eas-cli`,
`eas login`. Append `--no-submit` (e.g. `pnpm --filter community-mobile build:testflight --
--no-submit`) to just produce the ipa without uploading (the live-version check below still runs
first); the ipa lands in
`apps/community-mobile/build/` (gitignored) unless `--output <path>` says otherwise. After the
build the script reads the resolved config back out of the ipa (`EXConstants.bundle/app.config`)
and refuses to upload one whose baked API URL is not what the profile promises. Cloud equivalent,
if the build doesn't need to happen on your machine: `eas build --platform ios --profile
testflight|production --auto-submit` from `apps/community-mobile`.

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
- EAS project credentials for `org.civfix.community` (expo.dev -> Project credentials -> iOS): the
  distribution certificate + App Store provisioning profile, and an App Store Connect API key under
  Service credentials so `eas submit` never prompts for an Apple ID.
- The remote build number initialised once, above the highest build already in App Store Connect:
  `eas build:version:set -p ios` from this directory. An unset counter is silently seeded from
  `ios.buildNumber` in `app.config.js`, and a number App Store Connect has already seen is only
  rejected at upload time, after the whole build.

The build number is the only version EAS moves. The user-facing version (`version` in
`app.config.js`, mirrored in `package.json`; `CFBundleShortVersionString`) is bumped by hand, and
the moment matters: App Store Connect accepts any number of builds for a version until that version
is approved, then rejects every further upload of it ("You've already submitted this version of the
app"). So **the first PR after an App Store release bumps `version`** — `npm version patch
--no-git-tag-version` in this directory moves `package.json`, then set the same value in
`app.config.js` — or every push to `main` fails at upload time. `scripts/store-build.sh` runs
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

Config plugins for the native modules (camera/mic/location permission strings, Google sign-in URL
scheme, Apple auth, notifications) are declared in `apps/community-mobile/app.config.js`. The API base
URL comes from `EXPO_PUBLIC_API_URL`, surfaced via `extra.apiUrl`; when unset, dev builds fall back
to `http://localhost:8080` and release builds to `https://api.civfix.org` (`src/lib/apiUrl.ts`).

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
once and the layout adapts to screen WIDTH (`>= 840px` sidebar shell - iPad landscape; `< 840px`
bottom-sheet shell - phone, iPad portrait), not to platform. This app stays the native host: it
provides the data context (Bearer auth, the API client, the chat WebSocket), the platform
capabilities (vision-camera, geolocation, secure-store, push, MMKV/AsyncStorage persistence, haptics,
expo-blur), the maplibre-react-native basemap, and the `expo-router` deep-link adapter. The preserved
native shell (animated splash, forced sign-in gate, push register, `civfix://` deep links) is
unchanged - it only injects capabilities into the shared UI. `packages/ui/README.md` covers the
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

`src/theme/index.ts` adapts the platform-neutral shared tokens (`@civfix/shared/tokens`) into
RN-native values: rem font sizes -> px numbers, CSS box-shadows -> RN shadow/elevation objects,
numeric radii (the CSS-only `pin` corner is dropped), the category color map, and the loaded
`@expo-google-fonts` family names. It re-exports `categoryColor()` and adds a `wordmark` color list.
Do not hardcode hex/size values in components; import from the theme.

## Map basemap (decision)

- **The map ALWAYS uses the OpenStreetMap (CARTO Voyager) raster basemap.** This is the intentional,
  permanent basemap (`src/components/map/mapStyle.ts` -> `rasterMapStyle`), matching the design and the
  web app. An earlier plan would have served Protomaps PMTiles vector tiles from R2 (via
  `GET /map/tileinfo`); that plan was overridden, so the map needs nothing from R2 - or from the
  backend - to render. `GET /map/tileinfo` is still called only for its attribution string; the basemap
  draws regardless of whether it resolves. There is no `protomaps-mlrn` / PMTiles dependency.

### Onboarding map stills

The first-run tour's map cards (`src/components/onboarding/stages/MapStill.tsx`) are CARTO Voyager
(light) / Dark Matter (dark) crops of three real Los Angeles places — Highland Park (report), Boyle
Heights at Hollenbeck Park (track), Echo Park Lake (together) — shipped as static `@2x` PNGs in
`assets/onboarding/` so first launch needs no network, with `@civfix/ui` pins overlaid at real
coordinates by the stages. `node scripts/onboarding-map-art.mjs` regenerates them from the scene table
in `src/components/onboarding/onboardingMapScenes.ts` through the app's own tile URL rule and CARTO
key, writes the palettised stills plus a `manifest.json` (sha256, dimensions and the scene centre,
zoom and point size each still was cut from) that `tests/onboardingMapArt.test.ts` asserts against —
so editing a scene without regenerating fails the suite — and with `--preview <dir>` also writes
copies with the pin spots marked for checking the framing after moving a scene.

## Deferred / incompatible libraries

- **react-native-mmkv** is pinned to v3 (not v4) and **react-native-vision-camera** to v4 (not v5)
  because the latest majors require `react-native-nitro-modules` + `react-native-nitro-image`, which
  add native-build surface for libraries not used until later steps. v3/v4 install, typecheck, and
  pass expo-doctor, and have stable config plugins. Both are declared + configured now so the later
  report/chat steps need no new native config.
- **react-native-video / react-native-compressor** are declared for the later media flow; they
  autolink and need no config-plugin entry.

## @civfix/shared gaps observed (no shared changes made)

The contract was sufficient to build the map home. Minor gaps for a future shared revision:

1. No dedicated map-cleanups endpoint: cleanup pins on the map reuse `GET /cleanups` with a `near`
   filter. A bbox-scoped cleanup-pins endpoint (parallel to `GET /map/reports`) would be cleaner for
   dense maps.
2. No push-token / device-registration helper types beyond `RegisterPushTokenRequest`; fine for now.
3. `TileInfoResponse.pmtilesUrl` is typed but the mobile map intentionally does not consume it (the map
   uses the OpenStreetMap raster basemap; see "Map basemap" above). The app reads only `attribution`.

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
