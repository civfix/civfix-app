import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const launchThemeModule = readFileSync(
  new URL("../src/boot/launchTheme.ts", import.meta.url),
  "utf8",
)
const splash = readFileSync(
  new URL("../src/components/LoadingSplash.tsx", import.meta.url),
  "utf8",
)
const connectivity = readFileSync(
  new URL("../src/components/BootConnectivity.tsx", import.meta.url),
  "utf8",
)

test("the launch background is the light theme, never a scheme resolved at boot", () => {
  assert.match(launchThemeModule, /export const LAUNCH_SCHEME: ColorSchemeName = "light"/)
  assert.match(layout, /import \{ LAUNCH_SCHEME, launchTheme \} from "@\/boot\/launchTheme"/)
  assert.match(layout, /^void SystemUI\.setBackgroundColorAsync\(launchTheme\.colors\.bg\)$/m)
  assert.doesNotMatch(layout, /^const \w+ = themeFor\(/m)
})

test("the launch theme reaches the root layout only where the paper must stay light", () => {
  assert.deepEqual(
    [...layout.matchAll(/launchTheme\.[A-Za-z0-9_.]+/g)].map((m) => m[0]),
    ["launchTheme.colors.bg", "launchTheme.colors.bg", "launchTheme.colors.bg"],
  )
})

test("the pre-fonts gate paints the launch theme, not the live scheme", () => {
  const backdrop = layout.slice(
    layout.indexOf("function BootBackdrop"),
    layout.indexOf("let inAppBrowserOpen"),
  )
  assert.match(backdrop, /<StatusBar style="dark" \/>/)
  assert.match(backdrop, /<View style=\{styles\.gate\} \/>/)
  assert.doesNotMatch(backdrop, /useAppearanceTheme|useColorSchemeName/)
})

test("the gate stylesheet bakes the launch colour, so it cannot drift with the scheme", () => {
  const sheet = layout.slice(layout.indexOf("const styles = StyleSheet.create({"))
  assert.match(sheet, /gate: \{\n\s+flex: 1,\n\s+backgroundColor: launchTheme\.colors\.bg,\n\s+\}/)
  assert.match(sheet, /function crashStyles\(t: Theme\)/)
})

test("the system chrome and the native root background follow the launch scheme while the gate is up", () => {
  const stack = layout.slice(layout.indexOf("function RootStack"), layout.indexOf("export default"))
  assert.match(stack, /const liveScheme = useColorSchemeName\(\)/)
  assert.match(stack, /const scheme = launchGate \? LAUNCH_SCHEME : liveScheme/)
  assert.match(
    stack,
    /void SystemUI\.setBackgroundColorAsync\(launchGate \? launchTheme\.colors\.bg : t\.colors\.bg\)\n\s+\}, \[launchGate, t\.colors\.bg\]\)/,
  )
  assert.match(
    stack,
    /void NavigationBar\.setButtonStyleAsync\(scheme === "dark" \? "light" : "dark"\)/,
  )
  assert.match(stack, /<StatusBar style=\{scheme === "dark" \? "light" : "dark"\} \/>/)
  assert.match(layout, /<RootStack launchGate=\{gateMounted\} \/>/)
})

test("the wordmark screen resolves its styles once, against the launch scheme", () => {
  assert.match(splash, /import \{ LAUNCH_SCHEME \} from "@\/boot\/launchTheme"/)
  assert.match(splash, /const styles = makeThemedStyles\(\(t\) => \(\{/)
  assert.match(splash, /\}\)\)\.for\(LAUNCH_SCHEME\)/)
  assert.doesNotMatch(splash, /useStyles\(\)|useTheme\(\)/)
})

test("the wordmark screen spells out its ink, so no label falls back to the live scheme", () => {
  assert.match(splash, /\n  tag: \{[^}]+\n    color: t\.colors\.textSubtle,\n  \}/)
  assert.match(splash, /\n  connectingText: \{[^}]+\n    color: t\.colors\.textSubtle,\n  \}/)
  assert.match(splash, /\n  connectingActionLabel: \{[^}]+\n    color: t\.colors\.accentText,\n  \}/)
})

test("the offline boot gate is painted light too, while the sign-in notice stays live", () => {
  const gate = connectivity.slice(
    connectivity.indexOf("export function BootOfflineGate"),
    connectivity.indexOf("export function BootConnectivityNotice"),
  )
  assert.match(gate, /const th = launchTheme/)
  assert.match(gate, /const styles = useStyles\.for\(LAUNCH_SCHEME\)/)
  assert.match(gate, /<Icon icon=\{iconMap\.CloudOff\} size=\{22\} color=\{th\.colors\.textMuted\} \/>/)
  assert.match(gate, /<Text variant="title" color=\{th\.colors\.text\}/)
  assert.match(gate, /<Text variant="body" color=\{th\.colors\.textMuted\}/)

  const sheet = connectivity.slice(connectivity.indexOf("const useStyles = makeThemedStyles"))
  assert.match(sheet, /\n  primaryLabel: \{[^}]+\n    color: t\.colors\.onAccent,\n  \}/)
  assert.match(sheet, /\n  secondaryLabel: \{[^}]+\n    color: t\.colors\.textMuted,\n  \}/)

  const notice = connectivity.slice(connectivity.indexOf("export function BootConnectivityNotice"))
  assert.match(notice, /const th = useTheme\(\)/)
  assert.match(notice, /const styles = useStyles\(\)/)
})

test("the crash screen themes itself from the live scheme, like the app proper", () => {
  const boundary = layout.slice(layout.indexOf("export function ErrorBoundary"))
  assert.match(boundary, /const theme = useAppearanceTheme\(\)/)
  assert.match(boundary, /const crash = useMemo\(\(\) => crashStyles\(theme\), \[theme\]\)/)
  assert.match(boundary, /<StatusBar style=\{theme\.scheme === "dark" \? "light" : "dark"\} \/>/)
})

test("the live appearance hook re-applies the native root background when the scheme changes", () => {
  const hook = layout.slice(
    layout.indexOf("function useAppearanceTheme"),
    layout.indexOf("function BootBackdrop"),
  )
  assert.match(hook, /void SystemUI\.setBackgroundColorAsync\(theme\.colors\.bg\)/)
  assert.match(hook, /\}, \[theme\.colors\.bg\]\)/)
})

test("the offline gate's sign-out shows it is working and cannot be pressed twice", () => {
  const start = connectivity.indexOf("export function BootOfflineGate")
  const end = connectivity.indexOf("export function BootConnectivityNotice")
  assert.ok(start > -1 && end > start)
  const gate = connectivity.slice(start, end)
  // A ref, not the `signingOut` state: two taps inside one frame both read the stale state.
  assert.match(gate, /const inFlight = useRef\(false\)/)
  assert.match(gate, /if \(inFlight\.current\) return\s*inFlight\.current = true\s*setSigningOut\(true\)\s*try \{\s*await signOut\(\)\s*\} finally \{\s*inFlight\.current = false\s*setSigningOut\(false\)\s*\}/)
  assert.doesNotMatch(gate, /if \(signingOut\) return/)
  const button = gate.slice(gate.indexOf("onPress={onSignOut}") - 300)
  assert.match(button, /accessibilityState=\{\{ disabled: signingOut, busy: signingOut \}\}\s*disabled=\{signingOut\}\s*onPress=\{onSignOut\}/)
  assert.match(button, /\{signingOut \? \(\s*<ActivityIndicator color=\{th\.colors\.textMuted\} \/>/)
})
