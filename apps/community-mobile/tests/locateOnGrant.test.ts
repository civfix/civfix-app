import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"
import { FIRST_FIX_TIMEOUT_MS, GPS_TIMEOUT_MS } from "../src/lib/locationTimeouts.ts"

const hook = readFileSync(new URL("../src/hooks/useUserLocation.ts", import.meta.url), "utf8")
const home = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8")
const timeouts = readFileSync(new URL("../src/lib/locationTimeouts.ts", import.meta.url), "utf8")
const nativeMap = readFileSync(
  new URL("../../../packages/ui/src/map/Map.native.tsx", import.meta.url),
  "utf8",
)

const refreshBody = hook.slice(
  hook.indexOf("const refresh = useCallback("),
  hook.indexOf("const awaitFirstFix = useCallback("),
)
const launchEffect = hook.slice(hook.indexOf("useEffect(() => {"), hook.indexOf("return useMemo("))
const onLocateBody = home.slice(
  home.indexOf("const onLocate = useCallback("),
  home.indexOf("}, [awaitFirstFix,"),
)
const adoptEffect = home.slice(
  home.indexOf("if (initialCenterOwnedRef.current) return"),
  home.indexOf("}, [centerPlan, seedCenter, centerOnTarget])"),
)

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test("refresh reads the permission silently BEFORE it asks, so it knows whether the dialog granted it", () => {
  const before = refreshBody.indexOf("Location.getForegroundPermissionsAsync().catch(() => null)")
  const request = refreshBody.indexOf("Location.requestForegroundPermissionsAsync()")
  assert.ok(before > -1)
  assert.ok(request > before)
  assert.match(
    refreshBody,
    /const prompted = before !== null && before\.status !== Location\.PermissionStatus\.GRANTED/,
  )
})

test("a rejected permission probe never counts as a prompted grant", () => {
  assert.match(refreshBody, /getForegroundPermissionsAsync\(\)\.catch\(\(\) => null\)/)
  assert.match(refreshBody, /before !== null &&/)
  assert.doesNotMatch(refreshBody, /before\?\./)
})

test("the first-fix wait is the same fix read under the longer cap", () => {
  assert.match(hook, /const readFix = useCallback\(async \(timeoutMs: number = GPS_TIMEOUT_MS\)/)
  assert.match(hook, /const awaitFirstFix = useCallback\(\(\) => readFix\(FIRST_FIX_TIMEOUT_MS\), \[readFix\]\)/)
})

test("the silent launch check never raises the OS dialog", () => {
  assert.match(launchEffect, /getForegroundPermissionsAsync/)
  assert.doesNotMatch(launchEffect, /requestForegroundPermissionsAsync/)
  assert.equal(count(hook, "requestForegroundPermissionsAsync"), 1)
})

test("a locate tap claims ONE camera generation and delivers the late first fix on it, only after a prompted grant", () => {
  assert.equal(count(onLocateBody, "beginCameraRequest()"), 1)
  const gate = onLocateBody.indexOf("if (!prompted) return")
  const wait = onLocateBody.indexOf("await awaitFirstFix()")
  assert.ok(gate > -1)
  assert.ok(wait > gate)
  const flights = onLocateBody.match(/centerOnTarget\([^\n]*\n?/g) ?? []
  assert.equal(flights.length, 3)
  for (const flight of flights) assert.match(flight, /requestGeneration\)/)
})

test("the silent adoption effect stays latched off by a locate and never waits for a first fix", () => {
  assert.ok(adoptEffect.length > 0)
  assert.doesNotMatch(adoptEffect, /awaitFirstFix/)
  assert.match(home, /if \(initialCenterOwnedRef\.current\) return/)
})

test("the first-fix cap lives beside the GPS cap and outlasts it", () => {
  assert.match(timeouts, /export const FIRST_FIX_TIMEOUT_MS = /)
  assert.ok(FIRST_FIX_TIMEOUT_MS > GPS_TIMEOUT_MS)
})

test("a user map gesture claims a newer camera generation, which strands the late first fix", () => {
  assert.match(
    home,
    /const onUserCameraMove = useCallback\(\(\) => \{\n\s+initialCenterOwnedRef\.current = true\n\s+beginCameraRequest\(\)\n\s+\}, \[beginCameraRequest\]\)/,
  )
  assert.match(home, /onUserCameraMove=\{onUserCameraMove\}/)
})

test("the native seam reports only user-driven camera starts", () => {
  assert.match(nativeMap, /onRegionWillChange=\{handleRegionWillChange\}/)
  assert.match(
    nativeMap,
    /if \(!event\.nativeEvent\.userInteraction\) return\n\s+useMapFlyTo\.getState\(\)\.clear\(\)\n\s+onUserCameraMoveRef\.current\?\.\(\)/,
  )
})

test("the one-time launch move yields to an active Show on map target and to a gesture, as on web", () => {
  const owned = adoptEffect.indexOf("initialCenterOwnedRef.current = true")
  const yieldToTarget = adoptEffect.indexOf(
    "if (useMapFocus.getState().focus || useMapFlyTo.getState().highlight) return",
  )
  const flight = adoptEffect.indexOf("centerOnTarget(center)")
  assert.ok(owned > -1)
  assert.ok(yieldToTarget > owned)
  assert.ok(flight > yieldToTarget)
  assert.ok(home.indexOf("const initialCenterOwnedRef = useRef(") < home.indexOf("const onUserCameraMove = useCallback("))
})
