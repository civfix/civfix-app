import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const gate = readFileSync(
  new URL("../src/components/onboarding/OnboardingGate.tsx", import.meta.url),
  "utf8",
)
const store = readFileSync(new URL("../src/store/onboardingStore.ts", import.meta.url), "utf8")
const keys = readFileSync(new URL("../src/lib/mmkv-keys.ts", import.meta.url), "utf8")

test("the tour mounts BELOW the registration gate, so the two never share the screen", () => {
  const tour = layout.indexOf(
    "<OnboardingGate gateActive={gateActive} loadingGateMounted={gateMounted} />",
  )
  const firstRun = layout.indexOf("<FirstRunGate />")
  assert.ok(tour > -1)
  assert.ok(firstRun > tour)
})

test("the loading gate outranks the tour overlay on both platforms", () => {
  assert.match(gate, /zIndex: 40,\n\s+elevation: 40,/)
  assert.match(layout, /zIndex: 60,\n\s+elevation: 60,/)
  assert.match(layout, /style=\{\[StyleSheet\.absoluteFill, styles\.loadingGate, gateStyle\]\}/)
  assert.match(layout, /pointerEvents=\{gateActive \? "auto" : "none"\}/)
})

test("settings can replay the tour through the registered presenter", () => {
  assert.match(layout, /function OnboardingTourBridge\(\): null/)
  assert.match(
    layout,
    /setOnboardingTourPresenter\(\(\) => useOnboardingStore\.getState\(\)\.replay\(\)\)/,
  )
  assert.match(layout, /return \(\) => setOnboardingTourPresenter\(null\)/)
  assert.match(layout, /<OnboardingTourBridge \/>/)
})

test("the persisted completion flag is versioned and keyed by the shared storage key", () => {
  assert.match(keys, /export const ONBOARDING_KEY = "civfix\.onboarding"/)
  assert.match(store, /export const ONBOARDING_VERSION = 1/)
  assert.match(store, /name: ONBOARDING_KEY/)
  assert.match(store, /partialize: \(state\) => \(\{ completedVersion: state\.completedVersion \}\)/)
})

test("the location primer's storage key is single-sourced with the other MMKV keys", () => {
  assert.match(keys, /export const LOCATION_PRIMER_KEY = "civfix\.location-primer"/)
})

test("both persisted stores share the one MMKV zustand adapter", () => {
  const primer = readFileSync(
    new URL("../src/store/locationPrimerStore.ts", import.meta.url),
    "utf8",
  )
  const mmkv = readFileSync(new URL("../src/lib/mmkv.ts", import.meta.url), "utf8")
  assert.match(mmkv, /export const mmkvStateStorage: StateStorage = \{/)
  assert.match(store, /createJSONStorage\(\(\) => mmkvStateStorage\)/)
  assert.match(primer, /createJSONStorage\(\(\) => mmkvStateStorage\)/)
  assert.doesNotMatch(store, /: StateStorage = \{/)
  assert.doesNotMatch(primer, /: StateStorage = \{/)
})

test("the tour never navigates: it is a render gate over the already-mounted app", () => {
  assert.doesNotMatch(gate, /expo-router/)
  assert.match(gate, /shouldShowOnboarding\(/)
  assert.match(gate, /if \(!mounted\) return null/)
})

const readyPage = readFileSync(
  new URL("../src/components/onboarding/pages/ReadyPage.tsx", import.meta.url),
  "utf8",
)
const authOptions = readFileSync(
  new URL("../src/components/AuthOptions.tsx", import.meta.url),
  "utf8",
)
const pager = readFileSync(
  new URL("../src/components/onboarding/OnboardingPager.tsx", import.meta.url),
  "utf8",
)
const header = readFileSync(
  new URL("../src/components/onboarding/OnboardingHeader.tsx", import.meta.url),
  "utf8",
)
const home = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8")
const hook = readFileSync(new URL("../src/hooks/useUserLocation.ts", import.meta.url), "utf8")
const primer = readFileSync(
  new URL("../src/components/LocationPrimerSheet.tsx", import.meta.url),
  "utf8",
)
const togetherStage = readFileSync(
  new URL("../src/components/onboarding/stages/TogetherStage.tsx", import.meta.url),
  "utf8",
)

const themePage = readFileSync(
  new URL("../src/components/onboarding/pages/ThemePage.tsx", import.meta.url),
  "utf8",
)

test("the theme step sits between the community page and the sign-in page", () => {
  const together = pager.indexOf("<TogetherPage")
  const themeStep = pager.indexOf("<ThemePage")
  const ready = pager.indexOf("<ReadyPage")
  assert.ok(together > -1 && themeStep > together && ready > themeStep)
  assert.match(pager, /<ThemePage \{\.\.\.pageProps\} index=\{3\} active=\{index === 3\} \/>/)
  assert.match(pager, /<ReadyPage \{\.\.\.pageProps\} index=\{4\} active=\{index === 4\} onComplete=\{onComplete\} \/>/)
})

test("the theme step reuses the settings option list rather than a second picker", () => {
  assert.match(themePage, /import \{ AppearanceOptionList \} from "@civfix\/ui"/)
  assert.match(themePage, /<AppearanceOptionList \/>/)
  assert.doesNotMatch(themePage, /setAppearancePreference/)
})

test("the email path hands the screen back before pushing the OTP card above the overlay", () => {
  assert.match(readyPage, /<SignInOptions onHandoff=\{onComplete\} \/>/)
  assert.match(
    readyPage,
    /<AuthOptions\n\s+enabled=\{providers\.data \?\? ALL_PROVIDERS\}\n\s+onHandoff=\{onHandoff\}\n\s+next=\{resumeHref\}\n\s+\/>/,
  )
  const handoff = authOptions.indexOf("onHandoff?.()")
  const push = authOptions.indexOf('pathname: "/auth/otp"')
  assert.ok(handoff > -1)
  assert.ok(push > handoff)
})

test("the tour resumes on the route it was opened on, never on a hardcoded home", () => {
  assert.match(readyPage, /import \{ hrefFromRoute \} from "@\/lib\/authResume"/)
  assert.match(readyPage, /const pathname = usePathname\(\)/)
  assert.match(readyPage, /const params = useGlobalSearchParams\(\)/)
  assert.match(readyPage, /const resumeHref = hrefFromRoute\(pathname, params\)/)
  assert.doesNotMatch(readyPage, /HOME_HREF/)
})

test("a social sign-in never replaces the route it is already standing on", () => {
  assert.match(authOptions, /import \{ shouldReplaceOnSignIn \} from "@\/lib\/authResume"/)
  assert.match(authOptions, /const pathname = usePathname\(\)/)
  assert.match(
    authOptions,
    /if \(!shouldReplaceOnSignIn\(pathname, next\)\) return\n\s+router\.replace\(next\)/,
  )
})

test("a signed-in viewer gets a done button instead of the sign-in stack", () => {
  assert.match(readyPage, /const authed = useAuthStore\(\(s\) => s\.status\) === "authed"/)
  assert.match(readyPage, /authed \? t\("ready\.title_authed"\) : t\("ready\.title"\)/)
  assert.match(readyPage, /authed \? t\("ready\.body_authed"\) : t\("ready\.body"\)/)
  assert.match(readyPage, /<PrimaryButton label=\{t\("nav\.done"\)\} onPress=\{finish\} \/>/)
  assert.match(readyPage, /<TrustStrip \/>/)
  assert.match(readyPage, /<LegalLinks \/>/)
  const branch = readyPage.indexOf("{authed ? (")
  assert.ok(branch > -1)
  assert.ok(readyPage.indexOf("<SignInOptions") > branch)
  assert.ok(readyPage.indexOf("ready.guest") > branch)
})

test("the legal links are real links with a localized label and a 44pt target", () => {
  assert.match(readyPage, /const \{ t: tLegal \} = useT\("onboarding-terms"\)/)
  assert.match(readyPage, /accessibilityRole="link"\n\s+accessibilityLabel=\{tLegal\("a11y\.terms_link"\)\}/)
  assert.match(readyPage, /accessibilityRole="link"\n\s+accessibilityLabel=\{tLegal\("a11y\.privacy_link"\)\}/)
  assert.match(readyPage, /hitSlop=\{LINK_HIT_SLOP\}/)
  assert.match(readyPage, /legalLink: \{\n\s+minHeight: 44,/)
})

test("skip disappears on the last page, and firing it there is a no-op", () => {
  assert.match(pager, /const canSkip = skipVisible\(index\)/)
  assert.match(
    pager,
    /const onSkip = useCallback\(\(\) => \{\n\s+if \(!skipVisible\(index\)\) return\n\s+haptics\.selection\(\)/,
  )
  assert.match(pager, /<OnboardingHeader page=\{index\} showSkip=\{canSkip\} onSkip=\{onSkip\} \/>/)
  assert.match(header, /\{showSkip \? \(/)
})

test("the tour reports that it is on screen, exit animation included", () => {
  assert.match(store, /presenting: boolean/)
  assert.match(store, /setPresenting: \(value\) => set\(\{ presenting: value \}\)/)
  assert.match(store, /partialize: \(state\) => \(\{ completedVersion: state\.completedVersion \}\)/)
  assert.match(gate, /setPresenting\(mounted\)\n\s+return \(\) => setPresenting\(false\)/)
})

test("the primer waits for the tour, registration and the focused route", () => {
  assert.match(home, /const tourPresenting = useOnboardingStore\(\(s\) => s\.presenting\)/)
  assert.match(home, /const profileIncomplete = useAuthStore\(\(s\) => s\.user\?\.profileComplete === false\)/)
  assert.match(home, /useFocusEffect\(\n\s+useCallback\(\(\) => \{\n\s+setRouteFocused\(true\)/)
  assert.match(home, /tourPresenting,\n\s+profileIncomplete,\n\s+routeFocused,/)
})

test("the camera center and the primer decision are two independent effects", () => {
  assert.match(
    home,
    /if \(initialCenterOwnedRef\.current\) return\n\s+if \(seedCenter === null\) return/,
  )
  assert.match(
    home,
    /if \(primerPlan !== "prompt"\) return\n\s+setPrimerVisible\(true\)\n\s+\}, \[primerPlan\]\)/,
  )
})

test("the initial camera center is the resolved centre, never a hardcoded point", () => {
  assert.match(
    home,
    /resolveMapCenter\(\{\n\s+precise: location\.coords,\n\s+approximate: approximatePoint,\n\s+remembered: rememberedCenter,\n\s+\}\)/,
  )
  assert.match(home, /const \[rememberedCenter\] = useState<RememberedCenter \| null>\(readLastCenter\)/)
  assert.doesNotMatch(home, /DEFAULT_CENTER|NEUTRAL_CENTER/)
})

test("no map is mounted until a real centre exists", () => {
  assert.match(home, /const mapSeed = mapLifecycleRef\.current\.lastViewport \?\? seedCenter/)
  assert.match(home, /return mapSeed === null \? \(\n\s+<MapPending \/>/)
  assert.match(home, /initialCenter=\{mapSeed\}/)
})

test("a better source upgrades the camera and a worse one never downgrades it", () => {
  assert.match(
    home,
    /if \(!shouldAdoptCenter\(adoptedSourceRef\.current, source\)\) return\n\s+adoptedSourceRef\.current = source\n\s+initialCenterOwnedRef\.current = true\n\s+centerOnTarget\(center\)/,
  )
  assert.match(
    home,
    /if \(seedCenter !== null \|\| !centerPlan\.center\) return\n\s+adoptedSourceRef\.current = centerPlan\.source\n\s+setSeedCenter\(centerPlan\.center\)/,
  )
})

test("the primer offers precise or approximate, and dismissing IS the approximate answer", () => {
  assert.match(
    home,
    /const answerPrimer = useCallback\(\(\) => \{\n\s+setPrimerVisible\(false\)\n\s+markPrimerShown\(\)/,
  )
  for (const handler of ["onPrimerUseLocation", "onPrimerApproximate"]) {
    assert.match(home, new RegExp(`const ${handler} = useCallback\\(\\(\\) => \\{\\n\\s+answerPrimer\\(\\)`))
  }
  assert.match(home, /setLocationChoice\("precise"\)/)
  assert.match(home, /setLocationChoice\("approximate"\)/)
  assert.match(home, /onApproximate=\{onPrimerApproximate\}/)
  assert.doesNotMatch(home, /onEnterAddress|onPrimerLater/)
  assert.doesNotMatch(primer, /location\.address|location\.later|SecondaryButton/)
  assert.match(primer, /onClose=\{onApproximate\}/)
  assert.match(primer, /t\("location\.approximate"\)/)
})

test("the approximate point comes from the server, not from a third-party IP lookup", () => {
  assert.match(
    home,
    /const approximate = useApproximateLocation\(\{\n\s+enabled: location\.permissionResolved && location\.permission !== "granted",\n\s+\}\)/,
  )
  assert.match(
    home,
    /const nearPoint = location\.coords \?\? approximatePoint/,
  )
  assert.doesNotMatch(hook, /ipLocate/)
  assert.doesNotMatch(hook, /precise/)
})

test("the shared user-location cache has exactly one writer", () => {
  assert.doesNotMatch(home, /publishUserLocation/)
  assert.match(
    home,
    /if \(!nearPoint\) return\n\s+queryClient\.setQueryData<LatLng \| null>\(queryKeys\.userLocation, nearPoint\)/,
  )
  assert.equal(home.match(/queryKeys\.userLocation/g)?.length, 1)
})

test("every settled viewport is remembered for the next launch", () => {
  assert.match(
    home,
    /rememberMapViewport\(mapLifecycleRef\.current\.lastViewport\)\n\s+writeLastCenter\(\{/,
  )
  assert.match(keys, /export const LAST_MAP_CENTER_KEY = "civfix\.map\.last-center"/)
})

test("a remembered viewport both owns the initial center and counts as a landing", () => {
  assert.match(home, /createMapLifecycleState\(recallMapViewport\(\)\)/)
  assert.match(home, /const recalledViewport = recallMapViewport\(\) !== null/)
  assert.match(home, /const initialCenterOwnedRef = useRef\(recalledViewport\)/)
  assert.equal(home.match(/recallMapViewport\(\)/g)?.length, 2)
})

test("a replay is a session request, not an unwritten completion flag", () => {
  assert.match(store, /replayRequested: boolean/)
  assert.match(store, /replay: \(\) => set\(\{ replayRequested: true \}\)/)
  assert.match(
    store,
    /complete: \(\) => set\(\{ completedVersion: ONBOARDING_VERSION, replayRequested: false \}\)/,
  )
  assert.doesNotMatch(store, /set\(\{ completedVersion: 0 \}\)/)
  assert.doesNotMatch(store, /replayRequested: state\.replayRequested/)
  assert.match(gate, /const replayRequested = useOnboardingStore\(\(s\) => s\.replayRequested\)/)
  assert.match(gate, /currentVersion: ONBOARDING_VERSION,\n\s+replayRequested,/)
})

test("the tour takes over the loading gate without a second fade", () => {
  assert.match(
    layout,
    /<OnboardingGate gateActive=\{gateActive\} loadingGateMounted=\{gateMounted\} \/>/,
  )
  assert.match(gate, /loadingGateMounted,\n\}: \{\n\s+gateActive: boolean\n\s+loadingGateMounted: boolean\n\}/)
  assert.match(
    gate,
    /if \(onboardingEnterPlan\(\{ loadingGateMounted, reduceMotion \}\) === "instant"\) \{\n\s+cancelAnimation\(fade\)\n\s+fade\.value = 1/,
  )
  assert.doesNotMatch(gate, /handedOffFromLoadingGate/)
  assert.match(gate, /\}, \[mounted, visible, reduceMotion, loadingGateMounted, fade, drop\]\)/)
})

test("the back handler subscribes once per visibility, reading the page from a ref", () => {
  assert.match(gate, /const plan = onboardingBackPlan\(indexRef\.current\)/)
  assert.match(
    gate,
    /BackHandler\.addEventListener\("hardwareBackPress", onBackPress\)\n\s+return \(\) => subscription\.remove\(\)\n\s+\}, \[visible\]\)/,
  )
})

test("the typing bubble's loops exist only inside its own window", () => {
  assert.match(togetherStage, /const STEP_STOPS = stageStops\(TOTAL_MS, 1300, 1880, TYPING_IN_MS, TYPING_OUT_MS\)/)
  assert.match(togetherStage, /const typingVisible = active && step === TYPING_STEP/)
  assert.match(togetherStage, /\{typingVisible \? \(\n\s+<Animated\.View style=\{\[StyleSheet\.absoluteFill, typingStyle\]\}>\n\s+<TypingBubble /)
})

test("the header reads the locale through the shared i18n seam", () => {
  assert.match(header, /const \{ locale, setLocale \} = useLocale\(\)/)
  assert.doesNotMatch(header, /usePrefsStore/)
})

test("the demo people in the tour are obviously fictional", () => {
  const demo = readFileSync(
    new URL("../src/components/onboarding/demoWorld.ts", import.meta.url),
    "utf8",
  )
  const handles = [...demo.matchAll(/handle: "([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(handles, ["demo_maya", "demo_devon", "demo_priya"])
  for (const handle of handles) assert.match(handle, /^[A-Za-z0-9_]{3,20}$/)
})
