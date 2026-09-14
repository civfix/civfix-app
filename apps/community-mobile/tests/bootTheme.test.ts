import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")

test("the frozen boot theme is only the pre-React first paint, never a rendered value", () => {
  const uses = [...layout.matchAll(/bootTheme\.[A-Za-z.[\]"']+/g)].map((m) => m[0])
  assert.deepEqual(uses, ["bootTheme.colors.bg"])
  assert.match(layout, /^void SystemUI\.setBackgroundColorAsync\(bootTheme\.colors\.bg\)$/m)
})

test("no StatusBar reads the frozen scheme", () => {
  assert.doesNotMatch(layout, /bootTheme\.scheme/)
  assert.match(layout, /<StatusBar style=\{theme\.scheme === "dark" \? "light" : "dark"\} \/>/)
})

test("the pre-fonts gate paints the LIVE scheme, not a module-scope guess", () => {
  assert.match(layout, /function useBootScheme\(\): ColorSchemeName \{/)
  assert.match(layout, /const system = useColorScheme\(\)/)
  assert.match(layout, /return resolveColorScheme\(preference, system\)/)
  assert.match(layout, /const theme = useMemo\(\(\) => themeFor\(scheme\), \[scheme\]\)/)
  assert.match(layout, /return <BootBackdrop \/>/)
  assert.match(layout, /style=\{\[styles\.gate, \{ backgroundColor: theme\.colors\.bg \}\]\}/)
})

test("the native root background is re-applied whenever the boot scheme changes", () => {
  const hook = layout.slice(layout.indexOf("function useBootTheme"), layout.indexOf("function BootBackdrop"))
  assert.match(hook, /void SystemUI\.setBackgroundColorAsync\(theme\.colors\.bg\)/)
  assert.match(hook, /\}, \[theme\.colors\.bg\]\)/)
})

test("no StyleSheet entry bakes a colour from the frozen boot theme", () => {
  const sheet = layout.slice(layout.indexOf("const styles = StyleSheet.create({"))
  assert.doesNotMatch(sheet, /bootTheme/)
  assert.match(sheet, /function crashStyles\(t: Theme\)/)
})

test("the crash screen themes itself from the live scheme too", () => {
  const boundary = layout.slice(layout.indexOf("export function ErrorBoundary"))
  assert.match(boundary, /const theme = useBootTheme\(\)/)
  assert.match(boundary, /const crash = useMemo\(\(\) => crashStyles\(theme\), \[theme\]\)/)
})
