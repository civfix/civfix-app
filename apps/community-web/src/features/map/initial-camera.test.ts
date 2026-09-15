/**
 * The home map's initial camera: a resolved centre or no map at all, never a hardcoded point, and never
 * a fly over a deep-linked detail's focus (features/map/home-map.tsx).
 *
 * THE RACE. The centre resolves asynchronously (browser geolocation, else the server's approximate
 * location), so on a COLD deep link to a detail two cameras compete for the same map: the panel's
 * `useMapFocus` easeTo, published as soon as the detail body has coordinates, and this flyTo, which lands
 * whenever the resolve happens to finish. When the fly lands second it drags the map to the viewer's OWN
 * metro with the focused marker thousands of px off-screen, and nothing ever corrects it - focus
 * publishes once.
 *
 * `home-map.tsx` is a client component wired to maplibre, react-query and a dozen zustand stores, and this
 * app's vitest runs in the `node` environment with no DOM - so there is no renderer here to run the effect
 * against. What this pins instead is the ORDERING the fix consists of, plus the invariant the product
 * decision turns on: no map is mounted until a real centre exists, and the US centroid is gone.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const src = readFileSync(new URL("./home-map.tsx", import.meta.url), "utf8")
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

/** The body of the camera-adoption effect, isolated from the Locate bus's own flyTo calls. */
const adoptEffect = code.slice(
  code.indexOf("if (cameraOwnedRef.current) return"),
  code.indexOf("const recenter = () => {"),
)

describe("the resolved centre is the only centre", () => {
  it("has no hardcoded fallback coordinate anywhere", () => {
    expect(code).not.toContain("39.8283")
    expect(code).not.toContain("98.5795")
    expect(code).not.toContain("NEUTRAL_CENTER")
  })

  it("orders precise over the server's approximate location through the shared model", () => {
    expect(code).toContain("resolveMapCenter({")
    expect(code).toContain("precise: preciseCenter,")
    expect(code).toContain("approximate: approximatePoint,")
    expect(code).toContain("remembered: bootCamera,")
    expect(code).toContain("const approximate = useApproximateLocation()")
  })

  it("mounts NO map until a centre exists, and shows the finding-your-area surface meanwhile", () => {
    expect(code).toContain("if (seedCenter === null) return <MapPending />")
    expect(code).toContain("initialCenter={seedCenter}")
  })

  it("seeds the camera source at the same moment it seeds the centre, so the seed is never re-flown", () => {
    expect(code).toContain("setSeedCenter(centerPlan.center)")
    expect(code).toContain("adoptedSourceRef.current = centerPlan.source")
  })

  it("never mutates a camera ref during render - every write is in an effect", () => {
    const renderBody = code.slice(0, code.indexOf("const onRegionChange = React.useCallback("))
    for (const write of [
      "adoptedSourceRef.current =",
      "seedSourceRef.current =",
      "approximatePointRef.current =",
      "cameraOwnedRef.current =",
    ]) {
      let at = renderBody.indexOf(write)
      while (at !== -1) {
        const effectAt = renderBody.lastIndexOf("React.useEffect(", at)
        const closeAt = renderBody.lastIndexOf("\n  }, [", at)
        expect(effectAt).toBeGreaterThan(closeAt)
        at = renderBody.indexOf(write, at + 1)
      }
    }
  })
})

describe("the camera adoption effect", () => {
  it("reads the published focus and gives the camera up to it", () => {
    expect(adoptEffect).toContain("if (useMapFocus.getState().focus) return")
    expect(code).toContain("useMapFocus,")
  })

  it("checks at ADOPT time, not at mount, so a later focus still wins by publishing", () => {
    const guard = adoptEffect.indexOf("useMapFocus.getState().focus")
    const fly = adoptEffect.indexOf("mapRef.current?.flyTo(")
    expect(guard).toBeGreaterThan(-1)
    expect(fly).toBeGreaterThan(guard)
  })

  it("never yanks a map that booted from the persisted camera", () => {
    const boot = adoptEffect.indexOf('if (seedSourceRef.current === "remembered") return')
    const fly = adoptEffect.indexOf("mapRef.current?.flyTo(")
    expect(boot).toBeGreaterThan(-1)
    expect(fly).toBeGreaterThan(boot)
  })

  it("flies at most once, then hands the camera to the user", () => {
    const owned = adoptEffect.indexOf("if (cameraOwnedRef.current) return")
    const latch = adoptEffect.indexOf("cameraOwnedRef.current = true")
    const fly = adoptEffect.indexOf("mapRef.current?.flyTo(")
    expect(owned).toBe(0)
    expect(latch).toBeGreaterThan(owned)
    expect(fly).toBeGreaterThan(latch)
  })

  it("only ever upgrades the source, never downgrades it", () => {
    expect(code).toContain("if (!shouldAdoptCenter(adoptedSourceRef.current, source)) return")
    expect(code).toContain("adoptedSourceRef.current = source")
  })

  it("still lights the user dot only for a PRECISE fix - an approximate point draws none", () => {
    expect(code).toContain("setUserLocation(precise)")
    expect(code).not.toContain("setUserLocation(approximatePoint)")
  })

  it("leaves the Locate button's own fly unguarded - that one is a deliberate user action", () => {
    const recenter = code.slice(code.indexOf("const recenter = () => {"))
    expect(recenter).toContain("mapRef.current?.flyTo(precise.lat, precise.lng, PRECISE_ZOOM)")
    expect(recenter).toContain("const estimate = approximatePointRef.current")
    expect(recenter).not.toContain("useMapFocus")
  })
})

/**
 * The persisted boot camera (features/map/camera-snapshot.ts) - the cold-boot half of the "everything
 * loads twice" fix. Seed the map's FIRST frame from the last-settled camera (so the load-time region
 * fetch is the only one), never fly off it, and write the snapshot back on EVERY settle so the next boot
 * has it.
 */
describe("the persisted boot camera", () => {
  it("reads the snapshot synchronously ONCE at mount (lazy state) and feeds it to the centre model", () => {
    expect(code).toContain("const [bootCamera] = React.useState(readCameraSnapshot)")
    expect(code).toContain("remembered: bootCamera,")
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
