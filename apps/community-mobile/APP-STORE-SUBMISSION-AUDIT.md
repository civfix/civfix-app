# civfix Mobile — App Store / Play Store Submission Audit

**App:** civfix (community user app) · **Bundle / package:** `org.civfix.community` · **Version:** `0.1.0`
**Stack:** Expo SDK 54 / React Native 0.81 (New Architecture), MapLibre, vision-camera, expo-notifications, secure-store
**Targets:** Apple App Store + Google Play
**Audit date:** 2026-06-19 · **Method:** read-only static audit across `civfix-mobile`, `civfix-shared/packages/{ui,shared}`, and `civfix-backend`, run as 5 parallel review agents (UGC safety, account/auth, privacy/permissions, completeness, build/assets).

> ⚠️ **Verdict: NOT submission-ready.** As of this build the app would be **rejected by Apple** (and likely Google) on multiple independent grounds, and in its current state a build **cannot even be cleanly produced or uploaded** (placeholder EAS project, no build-number strategy). The dominant risk is **User-Generated Content safety (Apple Guideline 1.2)**: the app has chat + user-posted reports/photos but **no way for a user to report objectionable content and no terms acceptance** — this alone is a hard rejection. Account deletion (5.1.1(v)) and the iOS Privacy Manifest are also missing.

---

## 1. Severity legend

| Severity | Meaning |
|---|---|
| 🔴 **BLOCKER** | Will almost certainly cause rejection, or prevents a build from being produced/uploaded at all. Must fix before submitting. |
| 🟠 **HIGH** | Probable rejection or a feature a reviewer will exercise and find broken. Fix before submitting. |
| 🟡 **MEDIUM** | Conditional / second-pass rejection risk, or a disclosure/polish obligation. Fix soon. |
| ⚪ **LOW** | Polish, hygiene, or informational. Nice to fix. |

**Counts (deduplicated):** 🔴 8 BLOCKER · 🟠 10 HIGH · 🟡 11 MEDIUM · ⚪ 6 LOW

---

## 2. Blockers at a glance

| # | Blocker | Guideline | Type | Where |
|---|---|---|---|---|
| B1 | No way for users to **report/flag objectionable content** (chat, reports, photos, profiles) | Apple **1.2(b)** / Play UGC | Needs feature | `endpoints.ts` (no public flag endpoint); no UI in `packages/ui/src` |
| B2 | No **EULA / zero-tolerance terms acceptance** at signup | Apple **1.2(e)** | Needs feature | `AuthOptions.tsx:156-231` |
| B3 | No **in-app account deletion** | Apple **5.1.1(v)** / Play | Needs feature | absent in `ProfileBody.tsx`, `endpoints.ts`, backend |
| B4 | No **iOS Privacy Manifest** (`PrivacyInfo.xcprivacy`) | Apple privacy-manifest requirement | Config | not declared in `app.config.ts` |
| B5 | Missing **required-reason API** declaration for MMKV `UserDefaults` (ITMS-91053) | Apple required-reason API | Config | `src/lib/mmkv.ts`, no manifest |
| B6 | Placeholder **EAS project id** — blocks `eas build` and breaks push token mint | Build pipeline / 2.1 | Operational | `app.config.ts:155` |
| B7 | No **`eas.json`** and no iOS `buildNumber` / Android `versionCode` strategy | Store upload rules | Operational | repo root (none); `app.config.ts:42` |
| B8 | **"Continue with Google"** is a dead button when client-id env vars are unset | Apple **2.1** | Config | `app.config.ts:23-26`, `AuthOptions.tsx:92-127` |

---

## 3. Remediation roadmap (do in this order)

**Phase 0 — make a build possible (operational, ~hours):**
1. `eas init` in `apps/community-mobile` → real `extra.eas.projectId` + `updates.url` (fixes **B6**, **H7**). If OTA isn't wanted at launch, set `updates.enabled: false`.
2. Add `eas.json` with a `production` build+submit profile and `autoIncrement` (or set `ios.buildNumber`/`android.versionCode`) (fixes **B7**).
3. Provision Google OAuth client ids + reversed-client-id URL scheme; inject `EXPO_PUBLIC_GOOGLE_*` in the EAS build env (fixes **B8**, **M14**). Let EAS manage the Android upload keystore (fixes **M12**).

**Phase 1 — UGC safety, or Apple 1.2 fails (needs feature work, the critical path):**
4. Add a user-facing **"Report content"** action (reason picker) on chat messages, report/pin detail, photos, profiles, events; back it with a new public endpoint writing to the existing `moderation_items` queue; commit to 24h action (fixes **B1**, the #1 rejection).
5. Surface **terms/EULA acceptance with a zero-tolerance clause** at account creation and record it (fixes **B2**).
6. Add **Block** to profiles + group/cleanup chat (not just DMs), and ship a **Blocked-accounts** settings list (fixes **H1**, **M3**).
7. Add an in-app **Contact support / Report a problem** entry (fixes **M2**).
8. Turn on a real **content filter** — enable the NSFW model in prod + a text-moderation/blocklist pass for chat/descriptions/bios (fixes **H2**).

**Phase 2 — account, privacy, store config:**
9. Add **in-app account deletion** (`DELETE /me` → tombstone/anonymize + revoke sessions; wire a confirm flow in settings) (fixes **B3**).
10. Add `ios.privacyManifests` (collected data types + `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1`) (fixes **B4**, **B5**).
11. Set `ios.usesAppleSignIn: true`, re-prebuild, test a real Apple sign-in on TestFlight (fixes **H3**).
12. Add a **Terms · Privacy** link to the sign-in/register screen and **verify `https://civfix.org/legal/*` actually resolves** (fixes **H4**, **H5**).
13. Decide the **iPad story**: either test the ≥840px shell on iPad + upload iPad screenshots, or set `ios.supportsTablet: false` (fixes **H9**).
14. Add OSM/CARTO **attribution to `LocationPicker.native.tsx`** (fixes **H10**).
15. Prepare a **demo/review account** in App Store Connect → App Review Information (fixes **H6**); consider letting guests browse the public map (fixes **M1**).
16. Wire the **real push capability** into `mobileCapabilities` so the settings toggle works (fixes **H8**).

**Phase 3 — polish:** strip `[REPORTFLOW]` logs, delete `promoNotification.ts`, add a branded notification icon, verify the legacy About/Settings Donate link (M11), remove unused Android permissions, bump to `1.0.0`.

---

## 4. Detailed findings

### 4.1 UGC Safety & Moderation — Apple Guideline 1.2 *(highest risk area)*

This app has heavy UGC: user-typed civic **reports + photos/videos**, **1:1 and group chat** (threads, typing indicators), **profiles + social follows**, and **community events/cleanups**. Apple 1.2 requires *all of*: (a) content filtering, (b) report-content mechanism, (c) block users, (d) published contact point, (e) EULA/zero-tolerance terms. The app currently meets **none of (a),(b),(d),(e)** and only **partially (c)**.

- 🔴 **B1 — No mechanism to report/flag objectionable content.** *ABSENT* — searched `packages/ui/src` and `community-mobile` for report/flag/abuse/inappropriate UI (0 matches), and `shared/src/client/endpoints.ts` for a public flag endpoint. Every `flag*` endpoint (`flagReport`, `flagUser`, `flagEvent`, `flagDiscovery`) is **admin-only** (`endpoints.ts:1119, 1195, 1281, 1384`, `auth:"required"` operator). The app's noun "report" is a *civic issue report*, not content abuse. `AbuseSourceSchema` even defines a `"user_report"` source (`common.ts:233`) that nothing ever produces.
  *Guideline:* App Store 1.2(b) / Play UGC in-app reporting. *Fix:* user-facing Report action + public endpoint → `moderation_items`, act within 24h.
- 🔴 **B2 — No EULA / zero-tolerance terms acceptance at signup.** `AuthOptions.tsx:156-231` shows only a "We never share your email" blurb (`:227-229`); no terms link or checkbox. A real Acceptable-Use policy exists (`civfix-web/.../legal/terms/page.tsx` §6–7: no unlawful/harassing/sexually-explicit/CSAM content) but it is **web-only** and reached in mobile solely via an external link buried in the "About civfix" modal (`BrandAboutCard.tsx:31, 124-132`). Acceptance is never presented in onboarding or recorded.
  *Guideline:* App Store 1.2(e). *Fix:* surface terms + affirmative agreement at account creation, with an explicit zero-tolerance line.
- 🟠 **H1 — Block is DM-only.** Block is fully built server-side (`endpoints.ts:732/742/752`, `user_blocks`, `dm-service.ts`) but the **only** UI entry is the overflow menu of an open 1:1 DM (`ConversationBody.tsx:583,585,608,1128`). You **cannot block from a profile** (`PersonDetailBody.tsx` — 0 block matches), from **group/cleanup chat**, or from a **report's public discussion**. To block someone you must already be in a DM with them.
  *Guideline:* App Store 1.2(c). *Fix:* add Block to `PersonDetailBody` and to message authors in group chat + discussions.
- 🟠 **H2 — No proactive content filtering for text; media NSFW filter is OFF by default.** `civfix-backend/services/api/src/adapters/abuse-checks.ts:15-22, 175-188`: abuse checks cover **media only** (Turnstile, perceptual-hash dedup, GPS sanity, NSFW score), and the NSFW scorer **returns benign (0) by default**, gated behind `USE_REAL_NSFW` + an unwired vendored model (comment: "DEFAULT-FLAG PRODUCTION PUBLISHES BENIGN MEDIA"). There is **no text moderation/profanity filter anywhere** for chat, report descriptions, bios, or comments.
  *Guideline:* App Store 1.2(a) / Play content moderation. *Fix:* enable a real NSFW model in prod + add text moderation (or blocklist + the report-content queue above).
- 🟡 **M2 — No in-app support / contact / "report a problem".** *ABSENT* — the only support contact (`mailto:theo@reachoutla.org`) lives in the web Terms §16 (`legal/terms/page.tsx:289`); nothing in `community-mobile`. *Guideline:* 1.2(d). *Fix:* add a Settings → Contact support entry.
- 🟡 **M3 — Blocked-accounts management list intentionally not shipped.** `ProfileBody.tsx:16` comment: "the blocked-accounts list are intentionally NOT ported in this slice." `listBlocks` / `/me/blocks` exist but there's no screen to review or un-block. *Guideline:* 1.2(c). *Fix:* port the Blocked-accounts settings list.
- ⚪ **L6 — Recipient-side mitigation beyond block is thin in group chat.** Authors can edit/delete their own messages (`endpoints.ts:655, 486`); a DM user can block+leave, but a recipient of abusive *group/cleanup* messages has no per-message recourse. Subsumed by B1/H1.

#### UGC capability matrix

| Capability | Status | Evidence |
|---|---|---|
| Report content (1.2b) | **ABSENT** | no UI; all `flag*` endpoints admin-only (`endpoints.ts:1119/1195/1281/1384`) |
| Block users (1.2c) | **PARTIAL** | backend complete; UI DM-only (`ConversationBody.tsx:583`); none on profile/group; no blocked-list (`ProfileBody.tsx:16`) |
| Content filter (1.2a) | **PARTIAL** | media-only; NSFW off by default (`abuse-checks.ts:15-22`); no text moderation |
| EULA / zero-tolerance (1.2e) | **PARTIAL** | strong terms exist (web `legal/terms` §6-7) but never presented/accepted at signup (`AuthOptions.tsx`) |
| Contact point (1.2d) | **PARTIAL** | only in web Terms §16; none in-app |

---

### 4.2 Account Management & Authentication

**4.8 (Sign in with Apple parity): essentially PASS** — Apple renders at full parity with Google on iOS (`AuthOptions.tsx:152-153`, `showApple = enabled.includes("apple") && Platform.OS === "ios"`), correctly hidden on Android; a reviewer never sees Google-without-Apple unless the server's `enabledProviders` drops Apple while keeping Google (a server-config risk). **5.1.1(v) (account deletion): FAIL.**

- 🔴 **B3 — No in-app account deletion.** *ABSENT* — searched `ProfileBody.tsx`, `NotificationPrefsBody.tsx`, all of `shared/src`, all `community-mobile` `.tsx`, and the backend. The account surface offers only **Sign out** (`ProfileBody.tsx:371-380`). The `/me` + `/auth` contract (`endpoints.ts:790-826, 293-356`) has **no DELETE-account endpoint**; every `DELETE` verb is a sub-resource (unfollow, unblock, delete-message). The backend has no self-delete route (only admin ban/suspend). *(A `users.deleted_at` soft-delete column exists at `drizzle/0001_core.sql:30` and social queries already filter it — the data model supports deletion, but nothing triggers it.)* The app creates accounts (Apple/Google/OTP all mint a session, `useAuthFlow.ts:52-73`) and forces first-run registration (`register.tsx`, `_layout.tsx:278-288`), so deletion is mandatory.
  *Guideline:* App Store 5.1.1(v) / Play. *Fix:* `DELETE /me` (tombstone/anonymize + revoke sessions + cascade) → add to `endpoints.ts` → "Delete account" confirm flow in settings → run existing `signOut()` teardown. **The single most common 2024-2025 rejection.**
- 🟠 **H3 — `usesAppleSignIn` entitlement flag not set.** The `expo-apple-authentication` plugin is listed (`app.config.ts:97`) but the `ios` block (`:53-72`) never sets `ios.usesAppleSignIn: true`, so Expo won't add the `com.apple.developer.applesignin` entitlement to the generated `.entitlements`. Without it, `AppleAuthentication.signInAsync` (`AuthOptions.tsx:58`) can fail authorization on a real signed build — making the *only* Apple-parity login non-functional, which 4.8 treats as a failure (Apple sign-in must work, not merely render).
  *Guideline:* App Store 4.8. *Fix:* add `usesAppleSignIn: true`, re-prebuild, verify the entitlement + App ID capability, test on TestFlight.
- 🟡 **M1 — Forced login wall blocks guest browsing of public content.** `_layout.tsx:11-13, 173-192, 337-342` enforces a hard auth wall ("an unauthed viewer can only reach the /auth subtree, never the map or any feature"). Yet the core content is inherently public — map/discussion/profile endpoints are `auth:"optional"`, and the shared bodies already implement guest `SignInPrompt` fallbacks + a `requireAuth` deferral pattern. Apple frequently rejects apps that gate viewable, non-account content behind a login wall.
  *Guideline:* App Store 5.1.1(i). *Fix:* let guests view the map + read-only detail; prompt for sign-in only at the first account-requiring action.
- 🟡 **M4 — Sign-out never calls server `/auth/logout`.** `authStore.ts:154-163` clears the keychain token + cache + socket locally but never POSTs `/auth/logout` (which exists at `endpoints.ts:356`). Acceptable for a bearer-token model (credential destroyed on-device) but server-side revocation is safer. *Fix:* best-effort `await api.logout()` before clearing local state.
- ⚪ **L7 / L8 — Apple flow correctness (informational, compliant).** Visibility is `Platform.OS` + server-flag driven with no `isAvailableAsync()` guard — fine for supported iOS versions. Apple name/email handling is correct (requests `FULL_NAME`+`EMAIL`, forwards `fullName` only when present per Apple's first-auth-only rule, `AuthOptions.tsx:58-74`); ensure the backend persists the Apple name on first auth since it won't be sent again.

---

### 4.3 Privacy, Permissions & Data Collection

Permission↔usage parity is clean and there is **no tracking/ads/analytics SDK** (ATT correctly not required), but the iOS Privacy Manifest is absent and the privacy-policy link is unreachable pre-login.

- 🔴 **B4 — No app-level iOS Privacy Manifest (`PrivacyInfo.xcprivacy`).** Required for new submissions since 2024-05-01. There is no manifest for the app target anywhere (no committed `ios/`; `app.config.ts` declares no `ios.privacyManifests`). The app collects precise location, photos/videos, email, name, user content, and a device push token — an absent/empty manifest is inconsistent with that and triggers the standard upload warning/rejection.
  *Fix:* add `ios.privacyManifests` with `NSPrivacyCollectedDataTypes` (PreciseLocation, Photos/Videos, EmailAddress, Name, UserContent, DeviceID/PushToken, CoarseLocation; Linked=true, Tracking=false) + the required-reason entries below; confirm it lands in the generated `ios/civfix/PrivacyInfo.xcprivacy` after prebuild.
- 🔴 **B5 — Missing required-reason API declaration for MMKV (UserDefaults).** `react-native-mmkv` (`src/lib/mmkv.ts:16`, `package.json:51`) reads/writes `UserDefaults` and ships **no** `PrivacyInfo.xcprivacy` of its own — a documented cause of **ITMS-91053** ("Missing API declaration / NSPrivacyAccessedAPICategoryUserDefaults"). With no app-level manifest either (B4), nothing covers it.
  *Fix:* declare `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1` (and File Timestamp `C617.1` / System Boot Time `35F9.1` if Expo modules pull them in) in the app-level manifest.
- 🟠 **H4 — Privacy/Terms link unreachable on the pre-login surface.** The hard auth gate means an unauthenticated user only reaches `/auth`. The welcome/sign-in screen (`AuthOptions.tsx:225-230`) and `/register` have **no** Privacy/Terms link; the only link lives in `BrandAboutCard.tsx:31-32`, reached via the map logo **after** sign-in. A reviewer creating an account never sees a privacy-policy link.
  *Guideline:* App Store 5.1.1(i)/(v) / Play. *Fix:* add a "Terms · Privacy" row to `AuthOptions` / `register` using the existing `openExternal` + URLs.
- 🟠 **H5 — Privacy/Terms URL host deployment unverified.** Links are hardcoded to `https://civfix.org/legal/{terms,privacy}` (`BrandAboutCard.tsx:31-32`). The pages exist in `civfix-web` code, but no committed config pins the bare apex `civfix.org` to the community-web Pages project (only `admin.civfix.org` + registry/mail subdomains are documented). If the public site serves on a different host, both links 404 → the policy is inaccessible.
  *Fix:* confirm both URLs resolve to the deployed export before submission; update the two constants if the host differs.
- 🟡 **M5 — `SYSTEM_ALERT_WINDOW` in the manifest.** Present in the generated manifest (pulled in by the RN dev/debug overlay), not in `app.config.ts`, unused by app code. Must not ship in a release build. *Fix:* verify the production AAB (`aapt dump permissions`) has none; if it persists, add `tools:node="remove"`.
- 🟡 **M6 — Legacy `READ/WRITE_EXTERNAL_STORAGE` auto-added.** On `targetSdk 36` these are inert (scoped storage / photo picker used instead) — unused-permission noise that complicates the Play Data Safety form. *Fix:* strip with `tools:node="remove"` (or `maxSdkVersion`), verify the report-capture flow still works.
- 🟡 **M7 — Push/FCM permissions broaden the data-safety surface.** `expo-notifications` pulls in FCM (`RECEIVE_BOOT_COMPLETED`, `c2dm.RECEIVE`, OEM badge perms). Expected for push, but the device **push token** is a device identifier sent to the backend (`POST /push/register`, `src/push/register.ts:117`). *Fix:* disclose "Device or other IDs" on Play Data Safety + DeviceID on the iOS label (no code change).

---

### 4.4 Functionality, Completeness & Placeholders — Apple 2.1

- 🔴 **B6 — Placeholder EAS project id blocks build + breaks push.** `app.config.ts:155` `extra.eas.projectId: "00000000-…"`. Consumed at runtime by `src/push/register.ts:110-113` `getExpoPushTokenAsync({ projectId })` → Expo rejects the all-zeros id → no push token is ever minted (failure is gracefully swallowed at `register.ts:124-128`, so no crash — but push is dead). `eas build` also requires `eas init` to replace it first. *Fix:* `eas init`, re-test push end-to-end.
- 🔴 **B7 — No `eas.json`; no iOS `buildNumber` / Android `versionCode`.** No `eas.json` or `app.json` exists (config is `app.config.ts` only); `version: "0.1.0"` with no build numbers. Without an `autoIncrement` profile, every build ships build #1 and the **second** submission to either store is rejected ("version already exists"). *Fix:* add `eas.json` production build+submit profiles with `autoIncrement`, or set the build numbers explicitly.
- 🔴 **B8 — "Continue with Google" is a dead button when env vars unset.** `app.config.ts:23-26`: `GOOGLE_WEB_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID` default to `""`, `GOOGLE_IOS_URL_SCHEME` defaults to `…PLACEHOLDER`. The Google button renders whenever the provider list includes "google" (default `["apple","google","email"]`, `AuthOptions.tsx:43`); with an empty web client id `GoogleSignin.configure({})` + `signIn()` fails and the iOS native flow can't open. A reviewer tapping it hits a dead button → 2.1. *Fix:* provision the client ids + inject env vars at build time, or hide Google when unconfigured.
- 🟠 **H6 — No documented demo/review account; reviewer stuck at the login wall.** The full auth gate (`_layout.tsx:11-13, 337-342`) means a reviewer can't get past Apple/Google/email-OTP sign-in. `PUBLISH-CHECKLIST.md` has no review credentials. *Fix:* provide a demo account (or an email-OTP test inbox / bypass) in App Store Connect → App Review Information, and document it.
- 🟠 **H7 — OTA `updates.url` points at a dead all-zeros project.** `app.config.ts:160` + `runtimeVersion.policy:"appVersion"`. The binary builds, but on launch it checks for updates against a non-existent project (failed network calls; OTA non-functional). *Fix:* set the real EAS Update URL after `eas init`, or remove the `updates` block / set `enabled:false` until OTA is wanted.
- 🟠 **H8 — In-app "Push notifications" toggle never registers a token.** `_layout.tsx:70-84` spreads `...makeFakeCapabilities()` and overrides only camera/geolocation/blur/openExternal — **`push` stays a fake**. The settings toggle (`NotificationPrefsBody.tsx:65-72`) calls `if (next && push.isAvailable()) push.registerForToken()`, but `FakePush.isAvailable()` returns `false` (`fakes/index.ts:68-75`), so toggling push ON registers nothing. (Real push-on-sign-in still runs via `registerForPushNotifications()` but is blocked by B6.) The settings UI is misleading. *Fix:* inject the real push capability into `mobileCapabilities` (wrap `src/push/register.ts`); resolve B6 first. *(Note: the `secureStore`/`persistence` fakes are inert — no shared-UI consumers; the auth token uses the app's real `src/auth/storage.ts`. Not a problem.)*
- 🟡 **M8 — Production `[REPORTFLOW]` console logs ship in release.** 9 ungated `console.log` in `report/details.tsx:56,59,62`, `report/category.tsx:37,40`, `report/success.tsx:128,131,151,157` (e.g. `submit SUCCESS id=…`). Not user-visible but spam device logs / leak report ids. *Fix:* remove or `__DEV__`-gate.
- 🟡 **M9 — Dev-only promo-notification helper still imported in prod layout.** `src/dev/promoNotification.ts` is imported + invoked in `RootLayout` (`_layout.tsx:52-54, 310-311`). Inert unless `EXPO_PUBLIC_PROMO_NOTIF==="1"`, but the file's own header says "Remove before shipping." If that env var were ever set, it fires a fake "Your report has been resolved" notification (2.3 risk). *Fix:* delete the file + import/call.
- 🟡 **M10 — Notification icon/sound are explicit placeholders.** `app.config.ts:104-110` comment: "Placeholder assets; replace with branded notification icon/sound before launch." Only a `color` is set → Android falls back to a default glyph. *Fix:* add a branded monochrome notification icon.
- 🟡 **M11 — "Donate" external links.** Two distinct surfaces now, only one of them addressed:
  - **New (events overhaul, `@civfix/ui` 0.58.0):** a nonprofit event host's **Donate** CTA (`DonateBlock` on the event + organization pages) opens `https://civfix.org/donate/<orgSlug>` in an in-app Safari view (`SFSafariViewController` / Android Custom Tab, **address bar visible**, `enableBarCollapsing:false`), wired in `apps/community-mobile/app/_layout.tsx` as `openExternal.openInAppBrowser`. No payment data is entered in the app; the nonprofit is the merchant of record; the page carries the Gov. Code §12599.9 disclosures. The reviewer note (incl. the test card and the `EXPO_PUBLIC_DONATE_BROWSER_MODE=system` escape hatch) is in `apps/community-mobile/APP-REVIEW-NOTES.md`. *Nothing further to verify beyond the page being live in prod.*
  - **Legacy, STILL OPEN:** the About card + Settings row open `@civfix/ui` `externalUrls.ts` `DONATE_URL` = `https://reachoutla.org/help` (a third-party page; WebFetch returned HTTP 403 — bot-block, **inconclusive not confirmed-broken**). That constant lives in `@civfix/ui`, not in this repo. *Fix:* manually confirm it loads, or re-point it at civfix's own donation page. *(Terms/Privacy on the same card both returned HTTP 200 with real content — good.)*
- ⚪ **L3 — Version is `0.1.0` (pre-1.0).** Not a rejection alone, but with missing build numbers it signals a pre-release binary. *Fix:* bump to `1.0.0` + set build number.
- ⚪ **L4 — Stale comment** claims the API defaults to `localhost:8080`; the real default is `https://api.civfix.org` (`app.config.ts:14`, `src/config.ts:17`). Doc-only.
- ⚪ **L5 — `BigBuckBunny.jpg` sample** in `fakes/index.ts:33` is preview-only and overridden by the real native camera in production (`_layout.tsx:75`). Inert.

---

### 4.5 Build Config, Assets & Attribution

Identity and asset pipeline are largely submission-ready (real reverse-DNS ids; marketing icon has **no alpha**; encryption flag accurate; OSM attribution present on the *main* map). The blocking work is operational + a couple of review/ToS risks. Note: `android/` and `ios/` are gitignored (regenerated by `expo prebuild`); **no `ios/` has ever been generated on this box**, so the iOS native build is unproven.

- 🟠 **H9 — iPad supported while portrait-locked + phone-first.** `app.config.ts:43` `orientation:"portrait"` + `:55` `ios.supportsTablet:true`. With tablet support on, App Store Connect demands a full iPad screenshot set and reviewers test on iPad; a stretched iPhone layout draws 4.x design rejections. The shared UI adapts by width (≥840px sidebar shell) so it *may* pass, but must be verified on real iPad hardware. *Fix:* either commit to iPad (test + upload iPad screenshots) or set `supportsTablet:false`.
- 🟠 **H10 — LocationPicker map disables OSM/CARTO attribution.** `LocationPicker.native.tsx:96-98` sets both `logo={false}` and `attribution={false}` and renders no text credit (only a "Tap the map to place the pin" hint), while drawing the same CARTO Voyager (OSM data) tiles as the home map. This violates the OSM Tile Usage Policy / CARTO basemap ToS on that screen. *(Compliant comparators: `MiniMap.native.tsx:56-58` draws a faint "CARTO / OSM" text credit; `Map.native.tsx:245` keeps the native (i) button.)* *Fix:* remove `attribution={false}` or add a static "© OpenStreetMap / CARTO" credit.
- 🟡 **M12 — Release build signed with the debug keystore.** `android/app/build.gradle:118-121` `release` uses `signingConfigs.debug` (prebuild default; comment warns against it). Fine for local APKs, not for store upload. Informational since `android/` is regenerated. *Fix:* let EAS manage the upload keystore (`eas credentials`).
- 🟡 **M14 — No `ios/` project + Google iOS URL scheme placeholder.** `app.config.ts:26` falls back to `com.googleusercontent.apps.PLACEHOLDER` when the env var is unset; an iOS build without the real reversed-client-id ships a non-functional Google sign-in scheme. Overlaps **B8**. *Fix:* set `EXPO_PUBLIC_GOOGLE_IOS_*` in the EAS env; run a macOS/EAS iOS build to validate.
- 🟡 **M15 — New Architecture on + native libs pinned for compatibility.** `app.config.ts:46` `newArchEnabled:true`; README notes `react-native-mmkv` pinned to v3 and `vision-camera` to v4 to avoid Nitro, `react-native-compressor` excluded from the doctor check. Any module misbehaving under Fabric is a crash-on-launch risk. Not a config error — a **test obligation**. *Fix:* run the Play pre-launch report + a TestFlight pass on real devices (camera, MapLibre, video).
- 🟡 **M13 — `usesNonExemptEncryption:false` (confirm-only).** `app.config.ts:57` → `ITSAppUsesNonExemptEncryption=NO`. Accurate (only HTTPS/TLS + OS keychain/`expo-crypto` standard crypto, all exempt) and correctly avoids blocking the reviewer on the export-compliance prompt. No defect; don't add proprietary crypto later.
- ⚪ **L9 — Adaptive-icon safe zone.** `adaptive-icon.png` is correct (1024² RGBA); just preview the masked icon (Asset Studio / device) to confirm the teardrop sits in the 66% safe zone across mask shapes.

#### Asset measurements (from PNG header bytes)

| File | Dimensions | Color type | Alpha | Verdict |
|---|---|---|---|---|
| `assets/icon.png` | 1024×1024 | 2 (RGB) | **No** | ✅ correct marketing icon (iOS rejects alpha — none here) |
| `assets/adaptive-icon.png` | 1024×1024 | 6 (RGBA) | Yes | ✅ Android foreground — alpha expected |
| `assets/splash.png` | 1284×1284 | 6 (RGBA) | Yes | ✅ square, ample, `resizeMode:contain` |
| `assets/favicon.png` | 256×256 | 2 (RGB) | No | ✅ web only, irrelevant to binaries |

#### Generated Android `<uses-permission>` (merged release manifest)

Expected: `ACCESS_COARSE/FINE_LOCATION`, `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `USE_BIOMETRIC`/`USE_FINGERPRINT` (secure-store), FCM/Play (`c2dm.RECEIVE`, install-referrer), ~20 OEM badge perms.
**Media (maxSdk-gated):** `READ/WRITE_EXTERNAL_STORAGE` → see M6.
**⚠️ Surprise:** `SYSTEM_ALERT_WINDOW` (dev overlay) → see M5.
**✅ Good news:** **no `AD_ID`**, **no `ACCESS_BACKGROUND_LOCATION`**, **no `READ_MEDIA_IMAGES/VIDEO`** — the Play data-safety surface is limited.

---

## 5. Verified OK (audited, no action needed)

- **Permission↔usage parity** — all 4 iOS usage strings + Android permissions map to real code: CAMERA→vision-camera (`report/camera.tsx`), RECORD_AUDIO→mic permission (`camera.tsx:213,381`), location→expo-location (`useUserLocation.ts`, `nativeGeolocation.ts`), photos→expo-image-picker (`nativeCamera.ts:126`), POST_NOTIFICATIONS→expo-notifications. No unused declared permission.
- **iOS usage strings** are specific and honest (`app.config.ts:28-35`) — above the 5.1.1 bar.
- **No tracking/ads/analytics SDK** anywhere (no Segment/Amplitude/Mixpanel/Firebase-Analytics/AppsFlyer/Sentry/IDFA). ATT correctly not required; label "Tracking: No."
- **Location is foreground-only** — only `requestForegroundPermissionsAsync`; no background location / `UIBackgroundModes:location`.
- **No camera-roll write** (no `MediaLibrary`/`saveToLibraryAsync`) → `NSPhotoLibraryAddUsageDescription` correctly not needed. No Contacts/Calendar/Health.
- **Token storage is correct** — bearer token in `expo-secure-store` (Keychain/Keystore); the MMKV plaintext fallback is `__DEV__`-gated (`src/auth/storage.ts:48`), never used in production.
- **API is HTTPS, no cleartext** — `https://api.civfix.org` (`app.config.ts:14`, `src/config.ts:17`); EXIF/GPS stripped server-side.
- **Push consent is correct** (4.5.4 / Android 13) — `src/push/register.ts:102-108` only prompts when `canAskAgain`, never re-prompts a denial; `_layout.tsx:200-223` only registers if `prefs.push`; push is never required for core functionality (graceful no-op on failure).
- **Privacy policy content is thorough and accurate** (`civfix-web/.../legal/privacy/page.tsx`) — precise location flagged sensitive, identity providers, push token, IP processing, no ad trackers, no data sale, COPPA <13. *(Reachability is the gap — see H4/H5 — not the content.)*
- **Sign in with Apple parity** is correct on iOS; Apple hidden on Android; name/email handled per Apple's rules.
- **Bundle id / package** are clean reverse-DNS (`org.civfix.community`), consistent iOS↔Android, no `com.example`/`com.anonymous`/`host.exp.exponent` leakage.
- **Marketing icon** has no alpha; **fonts** (Baloo 2, Bricolage Grotesque, JetBrains Mono, Manrope) are OFL/Apache and Lucide is ISC — all redistributable, no restrictive assets.
- **Prior `["threads"]` cache-collision crash** is now guarded with split query keys + tests (`packages/ui/src/data/__tests__/discussion-cache.test.ts`); low residual risk. Push-token and Google-sign-in failures are both wrapped non-fatal (dead-feature, not crash).
- **Main map (home) shows OSM attribution** (`Map.native.tsx:245`) and `MiniMap` shows a text credit — only `LocationPicker` is non-compliant (H10).

---

## 6. Per-store summary

**Apple App Store — would be rejected on, at minimum:**
1.2 UGC safety (B1 report-content, B2 EULA, H1 block coverage, H2 filtering, M2 contact) · 5.1.1(v) account deletion (B3) · Privacy Manifest + required-reason API (B4, B5) · 5.1.1(i) privacy-policy reachability + forced login (H4, M1) · 4.8 Apple-sign-in entitlement (H3) · 2.1 dead Google button + no demo account (B8, H6) · 4.x/2.3 iPad (H9).

**Google Play — would be rejected / flagged on:**
UGC in-app reporting + moderation (B1, H2) · account deletion (in-app + web path) (B3) · Data Safety form completeness (M7 push token) · unused/overlay permissions (M5, M6) · debug-signed AAB (M12) · pre-launch report stability (M15). Play is generally more lenient on terms-acceptance and Apple-sign-in (N/A), but UGC reporting + account deletion are enforced on both.

---

## 7. Key files for remediation

| Concern | File |
|---|---|
| UGC report + block UI | `civfix-shared/packages/ui/src/bodies/ConversationBody.tsx`, `PersonDetailBody.tsx`, `ProfileBody.tsx` |
| Terms at signup; Privacy link | `civfix-mobile/.../src/components/AuthOptions.tsx`, `app/register.tsx`, `packages/ui/src/primitives/BrandAboutCard.tsx` |
| Report-content + delete-account endpoints | `civfix-shared/packages/shared/src/client/endpoints.ts` + `civfix-backend` routes |
| Content moderation | `civfix-backend/services/api/src/adapters/abuse-checks.ts` |
| Privacy manifest, permissions, EAS, Apple entitlement, Google ids, encryption, iPad | `civfix-mobile/apps/community-mobile/app.config.ts` |
| Push capability wiring | `civfix-mobile/.../app/_layout.tsx`, `src/push/register.ts` |
| Map attribution | `civfix-shared/packages/ui/src/map/LocationPicker.native.tsx` |
| Build profiles / signing / build numbers | new `civfix-mobile/apps/community-mobile/eas.json` |

---

*Generated by a 5-agent parallel static audit. Findings cite `file:line` evidence; severities reflect observed 2024-2026 App Store / Play review behavior. This is a static review — it does not replace a TestFlight/internal-track pass on real devices, which is required to clear the stability (M15) and iPad (H9) items.*
