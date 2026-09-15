import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const splash = readFileSync(
  new URL("../src/components/LoadingSplash.tsx", import.meta.url),
  "utf8",
)
const connectivity = readFileSync(
  new URL("../src/components/BootConnectivity.tsx", import.meta.url),
  "utf8",
)

test("the launch background is the light theme, never a scheme resolved at boot", () => {
  assert.match(layout, /import \{ LAUNCH_SCHEME, launchTheme \} from "@\/boot\/launchTheme"/)
  assert.match(layout, /^void SystemUI\.setBackgroundColorAsync\(launchTheme\.colors\.bg\)$/m)
  assert.doesNotMatch(layout, /themeFor\(\n\s+resolveColorScheme\(/)
})

test("the pre-fonts gate paints the launch theme, not the live scheme", () => {
  const backdrop = layout.slice(
    layout.indexOf("function BootBackdrop"),
    layout.indexOf("let inAppBrowserOpen"),
  )
  assert.match(backdrop, /<StatusBar style=\{launchTheme\.scheme === "dark" \? "light" : "dark"\} \/>/)
  assert.match(backdrop, /<View style=\{styles\.gate\} \/>/)
  assert.doesNotMatch(backdrop, /useAppearanceTheme|useColorSchemeName/)
})

test("the gate stylesheet bakes the launch colour, so it cannot drift with the scheme", () => {
  const sheet = layout.slice(layout.indexOf("const styles = StyleSheet.create({"))
  assert.match(sheet, /gate: \{\n\s+flex: 1,\n\s+backgroundColor: launchTheme\.colors\.bg,\n\s+\}/)
  assert.match(sheet, /function crashStyles\(t: Theme\)/)
})

test("the system chrome follows the launch scheme while the gate is up", () => {
  const stack = layout.slice(layout.indexOf("function RootStack"), layout.indexOf("export default"))
  assert.match(stack, /const liveScheme = useColorSchemeName\(\)/)
  assert.match(stack, /const scheme = launchGate \? LAUNCH_SCHEME : liveScheme/)
  assert.match(layout, /<RootStack launchGate=\{gateMounted\} \/>/)
})

test("the wordmark screen resolves its styles once, against the launch scheme", () => {
  assert.match(splash, /import \{ LAUNCH_SCHEME \} from "@\/boot\/launchTheme"/)
  assert.match(splash, /const styles = makeThemedStyles\(\(t\) => \(\{/)
  assert.match(splash, /\}\)\)\.for\(LAUNCH_SCHEME\)/)
  assert.doesNotMatch(splash, /useStyles\(\)|useTheme\(\)/)
})

test("the offline boot gate is painted light too, while the sign-in notice stays live", () => {
  const gate = connectivity.slice(
    connectivity.indexOf("export function BootOfflineGate"),
    connectivity.indexOf("export function BootConnectivityNotice"),
  )
  assert.match(gate, /const th = launchTheme/)
  assert.match(gate, /const styles = useStyles\.for\(LAUNCH_SCHEME\)/)
  assert.match(gate, /<Text variant="title" color=\{th\.colors\.text\}/)

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
