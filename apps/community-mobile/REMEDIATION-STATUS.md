# civfix-mobile — App Store Submission Audit: Remediation Status

Scope of this document: the **MOBILE APP-CONFIG + AUTH slice** of the App-Store-submission-audit
remediation. All paths are relative to `apps/community-mobile/` unless noted. This slice touches only
app-local files and verifies against the already-published `@civfix/ui ^0.10.0` (no new shared exports).

---

## Part I — Code fixes APPLIED in this slice

| Audit id | Fix | File(s) |
|---|---|---|
| **H3** | `ios.usesAppleSignIn: true` → Expo adds the `com.apple.developer.applesignin` entitlement at prebuild. | `app.config.ts` (ios block) |
| **B4 + B5** | Added `ios.privacyManifests` (Apple Privacy Manifest → `ios/civfix/PrivacyInfo.xcprivacy`). Declares required-reason APIs and every collected data type (details below). B5 (MMKV/UserDefaults ITMS-91053) is covered by the `CA92.1` reason. | `app.config.ts` (ios block) |
| **H9** | `ios.supportsTablet: false` — ship iPhone-only to avoid the iPad screenshot/test obligation. | `app.config.ts` |
| **B7 / L3** | `version: "1.0.0"`, `ios.buildNumber: "1"`, `android.versionCode: 1`. eas.json production `autoIncrement` takes over after the 1.0.0 baseline. | `app.config.ts` |
| **B7** | Created `eas.json` with `development` / `preview` / `production` build profiles (`production.autoIncrement: true`) + a `submit.production` stub. | `eas.json` (new) |
| **H7** (stopgap) | `updates: { enabled: false }` so the app does not check the dead all-zeros EAS Update project at launch. Commented that a real EAS Update URL from `eas init` must replace it. | `app.config.ts` |
| **B6** (doc) | Left the placeholder `extra.eas.projectId` as-is, but added a comment that it is a placeholder requiring `eas init`. | `app.config.ts` |
| **M13** | Confirmed `ios.config.usesNonExemptEncryption: false` is accurate; left as-is (commented). | `app.config.ts` |
| **H8** | Created a real `PushCapability` (`nativePush`) wrapping `src/push/register.ts` `registerForPushNotifications()` and added `push: nativePush` to the `mobileCapabilities` bundle, replacing the FakePush no-op the settings push toggle was hitting. | `src/lib/nativePush.ts` (new), `app/_layout.tsx` |
| **M9** | Deleted the `usePromoNotification` import + call in `app/_layout.tsx` and deleted `src/dev/promoNotification.ts` (the now-empty `src/dev/` dir was removed). | `app/_layout.tsx`, `src/dev/promoNotification.ts` (deleted) |
| **M8** | Removed all 9 ungated `[REPORTFLOW]` `console.log` calls (production log spam / report-id leak). | `app/report/details.tsx`, `app/report/category.tsx`, `app/report/success.tsx` |
| **B2 + H4** | AuthOptions + register: added a reachable **Terms · Privacy** link row (two `Pressable`s, `accessibilityRole="link"`, `·` separator, opened via `useOpenExternal()`) and a **zero-tolerance consent caption** ("By continuing you agree to our Terms (which include a zero-tolerance policy for objectionable content and abusive users) and Privacy Policy."). | `src/components/AuthOptions.tsx`, `app/register.tsx` |
| **B8** (stopgap) | Hide the Google sign-in button when `GOOGLE_WEB_CLIENT_ID` is empty (`showGoogle = enabled.includes("google") && !!GOOGLE_WEB_CLIENT_ID`) so it is not a dead button until the OAuth ids land. | `src/components/AuthOptions.tsx` |

### Privacy-manifest data declared (B4/B5)

`NSPrivacyAccessedAPITypes` (required-reason APIs):
- `NSPrivacyAccessedAPICategoryUserDefaults` → reason **`CA92.1`** (MMKV reads/writes iOS UserDefaults — closes ITMS-91053 / B5)
- `NSPrivacyAccessedAPICategoryFileTimestamp` → reason **`C617.1`** (Expo / RN runtime modules)
- `NSPrivacyAccessedAPICategorySystemBootTime` → reason **`35F9.1`** (Expo / RN runtime modules)

`NSPrivacyCollectedDataTypes` (each `Linked: true`, `Tracking: false`, purpose `AppFunctionality`):
- `NSPrivacyCollectedDataTypePreciseLocation` — report placement + nearby issues (expo-location)
- `NSPrivacyCollectedDataTypeCoarseLocation` — IP/approximate map centering
- `NSPrivacyCollectedDataTypePhotosorVideos` — media attached to a report
- `NSPrivacyCollectedDataTypeEmailAddress` — sign-in / OTP
- `NSPrivacyCollectedDataTypeName` — display name shown to neighbors
- `NSPrivacyCollectedDataTypeUserContent` — report text, chat messages, comments (UserGeneratedContent)
- `NSPrivacyCollectedDataTypeDeviceID` — Expo push token

Plus top-level `NSPrivacyTracking: false` and `NSPrivacyTrackingDomains: []`.

### eas.json profiles created (B7)
- `build.development` — `developmentClient: true`, internal distribution, channel `development`
- `build.preview` — internal distribution, channel `preview`, `ios.simulator: false`
- `build.production` — channel `production`, **`autoIncrement: true`**
- `submit.production` — iOS (`appleId` / `ascAppId` / `appleTeamId`) + Android (`serviceAccountKeyPath` / `track: internal`) placeholders, with a `//` note that real credentials are provisioned via `eas init` / `eas credentials` / `eas submit` and stored server-side (never committed).
- `cli.appVersionSource: "remote"` so EAS owns the auto-incremented build number.

### AuthOptions consent text (exact)
> By continuing you agree to our Terms (which include a zero-tolerance policy for objectionable content and abusive users) and Privacy Policy.

With a `Terms · Privacy` link row underneath → `https://civfix.org/legal/terms` / `https://civfix.org/legal/privacy`. The same caption + link row is mirrored in `app/register.tsx`.

---

## Part II — Items that REQUIRE EXTERNAL PROVISIONING (cannot be code-fixed)

These need an Expo / Apple / Google account or a design asset. They are documented here, NOT fabricated.

### B6 — Real EAS project id
- **What:** `extra.eas.projectId` in `app.config.ts` is the all-zeros placeholder. A real id is required for push-token minting (`src/push/register.ts` → `getExpoPushTokenAsync`) and EAS builds.
- **Command:** `cd apps/community-mobile && eas init` (requires an Expo account). It writes the real `projectId` into `app.config.ts` `extra.eas.projectId`.
- **Lands in:** `app.config.ts` (`extra.eas.projectId`); unblocks H8 token minting.

### H7 — Real EAS Update URL
- **What:** OTA updates are currently `updates: { enabled: false }` (stopgap). To enable OTA, set `updates.url` to the real EAS Update endpoint.
- **Command:** after `eas init`, set `updates: { url: "https://u.expo.dev/<real-project-id>" }` (id matches B6). Optionally `eas update:configure`.
- **Lands in:** `app.config.ts` (`updates`).

### B8 / M14 — Google OAuth client ids + reversed-client-id URL scheme
- **What:** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` (the iOS client's **reversed** client id) are empty/placeholder. The Google button is currently hidden (B8 stopgap) until these are real.
- **Where:** create OAuth clients in the Google Cloud Console (web + iOS, bundle `org.civfix.community`). Inject the three values as EAS build-env vars: `eas env:create` (or the EAS build `env`). The backend `GOOGLE_OAUTH_CLIENT_ID` must equal the **web** client id (token audience).
- **Lands in:** EAS build env → `app.config.ts` lines reading `process.env.EXPO_PUBLIC_GOOGLE_*` (the `GOOGLE_IOS_URL_SCHEME` feeds the `@react-native-google-signin/google-signin` plugin `iosUrlScheme`). Then remove the `!!GOOGLE_WEB_CLIENT_ID` guard in `AuthOptions.tsx`.

### H3 (portal step) — Sign in with Apple capability + TestFlight test
- **What:** The code flag `ios.usesAppleSignIn: true` is in-repo, but the App ID capability must be enabled externally and the flow tested.
- **Where:** Apple Developer portal → Certificates, Identifiers & Profiles → the `org.civfix.community` App ID → enable **Sign in with Apple**. Then run a **TestFlight** build and sign in with Apple on a real device.

### H6 — Demo review account
- **What:** The app has a hard auth wall (`app/_layout.tsx` gates everything behind sign-in), so a reviewer cannot get in without credentials.
- **Where:** App Store Connect → the app → **App Review Information** → provide a demo account (email + OTP test inbox, or a seeded login) + notes on how to receive the OTP. Document it in a PUBLISH-CHECKLIST as well.

### M10 — Branded notification icon asset
- **What:** The `expo-notifications` plugin only sets `color`; it needs a branded **monochrome** notification icon (Android status-bar / iOS).
- **Where:** design produces the asset (e.g. `assets/notification-icon.png`), then add `icon: "./assets/notification-icon.png"` (and optional `sound`) to the `expo-notifications` plugin options in `app.config.ts`.

### M12 — Android upload keystore
- **What:** A production AAB must be signed with a managed upload keystore.
- **Command:** `eas credentials` (Android) → let EAS generate/manage the upload keystore. No keystore is committed.

### M5 / M6 — Verify production AAB permissions
- **What:** Confirm the built Android AAB does not carry `SYSTEM_ALERT_WINDOW` or legacy storage permissions auto-merged by dependencies (they are not declared in `app.config.ts`).
- **Where:** build the production AAB (`eas build -p android --profile production`), then inspect the merged manifest (`bundletool` / `aapt2 dump badging`, or Android Studio's APK Analyzer). If unwanted permissions persist, strip them via a config-plugin manifest edit (`tools:node="remove"`). Build-time verification, not an `app.config.ts` edit.

### B4 / B5 native verification (build-time)
- **What:** `ios/` has never been generated on this box. The privacy manifest + Apple-signin entitlement only materialize after `expo prebuild` on macOS / an EAS build. The `app.config.ts` edits are in-repo; the **verification** (that `PrivacyInfo.xcprivacy` and `civfix.entitlements` are correct) is external.
- **Where:** macOS `expo prebuild` or `eas build -p ios`, then inspect `ios/civfix/PrivacyInfo.xcprivacy` and `ios/civfix/civfix.entitlements`.

---

## Verification (this slice)
- App typecheck: `pnpm -C apps/community-mobile typecheck` (`tsc --noEmit`) — see the slice report for the result. No new typecheck errors introduced by these edits.
- `app.config.ts` still evaluates to a valid `ExpoConfig`.
