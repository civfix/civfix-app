/**
 * The home map's one-time initial camera must not fly over a deep-linked detail's focus
 * (features/map/home-map.tsx).
 *
 * THE RACE. `resolveInitialCenter()` is async (browser geolocation, else an IP lookup), so on a COLD deep
 * link to a detail two cameras compete for the same map: the panel's `useMapFocus` easeTo, published as
 * soon as the detail body has coordinates, and this flyTo, which lands whenever the resolve happens to
 * finish. When the fly lands second it drags the map to the viewer's OWN metro with the focused marker
 * thousands of px off-screen, and nothing ever corrects it - focus publishes once. Measured on this build
 * before the guard: `/cleanups/e1` landed on the clear-strip centre 1/4 cold loads at 840x630 and 1/4 at
 * 1440x900 (marker at x=-5416 on the misses); `/pin/r-pothole` passed only because its body resolves ~2s
 * later than the fly, which is luck, not a rule.
 *
 * `home-map.tsx` is a client component wired to maplibre, react-query and a dozen zustand stores, and this
 * app's vitest runs in the `node` environment with no DOM - so there is no renderer here to run the effect
 * against. What this pins instead is the one ORDERING the fix consists of, which is exactly what a future
 * tidy-up would undo: the focus check reads the store at RESOLVE time and sits between the user-dot write
 * and the flyTo.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const src = readFileSync(new URL("./home-map.tsx", import.meta.url), "utf8")
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

/** The body of the one-time initial-center effect, isolated from the Locate bus's own flyTo calls. */
const initialEffect = code.slice(
  code.indexOf("const target = await resolveInitialCenter()"),
  code.indexOf("const recenter = () => {"),
)

describe("the one-time initial center", () => {
  it("reads the published focus and gives the camera up to it", () => {
    expect(initialEffect).toContain("if (useMapFocus.getState().focus) return")
    expect(code).toContain("useMapFocus,")
  })

  it("checks at RESOLVE time, not at mount, so a later focus still wins by publishing", () => {
    // `getState()` inside the awaited body (rather than a value captured when the effect ran) is what
    // makes "whoever published last wins" true in both directions: a focus that arrives AFTER this has
    // already flown overrides it with its own easeTo.
    const guard = initialEffect.indexOf("useMapFocus.getState().focus")
    const await_ = initialEffect.indexOf("await resolveInitialCenter()")
    expect(await_).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(await_)
  })

  it("still lights the user dot - the dot marks the user, not the camera", () => {
    const dot = initialEffect.indexOf("setUserLocation(target.point)")
    const guard = initialEffect.indexOf("if (useMapFocus.getState().focus) return")
    const fly = initialEffect.indexOf("mapRef.current?.flyTo(")
    expect(dot).toBeGreaterThan(-1)
    // dot -> guard -> fly: a focused deep link keeps its precise-location dot and loses only the camera.
    expect(guard).toBeGreaterThan(dot)
    expect(fly).toBeGreaterThan(guard)
  })

  it("leaves the Locate button's own fly unguarded - that one is a deliberate user action", () => {
    const recenter = code.slice(code.indexOf("const recenter = () => {"))
    expect(recenter).toContain("mapRef.current?.flyTo(precise.lat, precise.lng, PRECISE_ZOOM)")
    expect(recenter).not.toContain("useMapFocus")
  })
})

/**
 * The persisted boot camera (features/map/camera-snapshot.ts) - the cold-boot half of the "everything
 * loads twice" fix. The orderings pinned here are the fix: seed the map's FIRST frame from the
 * last-settled camera (so the load-time region fetch is the only one), skip the locate fly when that
 * seed was used (flying would re-trigger the second fetch the seed exists to eliminate), and write the
 * snapshot back on EVERY settle so the next boot has it.
 */
describe("the persisted boot camera", () => {
  it("reads the snapshot synchronously ONCE at mount (lazy state) and seeds the shared Map with it", () => {
    expect(code).toContain("const [bootCamera] = React.useState(readCameraSnapshot)")
    expect(code).toContain("initialCenter={bootCamera}")
  })

  it("skips the locate fly when booted from the snapshot - after the dot, before the focus guard", () => {
    // dot -> boot-camera skip -> focus guard -> fly: a returning visitor keeps their precise-location
    // dot and their boot camera; only a first-ever visit (no snapshot) reaches the flight at all.
    const dot = initialEffect.indexOf("setUserLocation(target.point)")
    const boot = initialEffect.indexOf("if (bootCamera) return")
    const guard = initialEffect.indexOf("if (useMapFocus.getState().focus) return")
    const fly = initialEffect.indexOf("mapRef.current?.flyTo(")
    expect(dot).toBeGreaterThan(-1)
    expect(boot).toBeGreaterThan(dot)
    expect(guard).toBeGreaterThan(boot)
    expect(fly).toBeGreaterThan(guard)
  })

  it("persists every settled region (before the fetch decision) so the next boot lands there", () => {
    const settle = code.slice(
      code.indexOf("const onRegionChange = React.useCallback("),
      code.indexOf("React.useEffect(() => {", code.indexOf("const onRegionChange = React.useCallback(")),
    )
    const write = settle.indexOf("writeCameraSnapshot(viewport, zoom)")
    const decide = settle.indexOf("decideRegionFetch(")
    expect(write).toBeGreaterThan(-1)
    // Before the decision on purpose: a settle that needs no refetch is still where the user last sat.
    expect(decide).toBeGreaterThan(write)
  })
})
