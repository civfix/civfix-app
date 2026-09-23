/**
 * Retention only works if three things hold, each independently deletable:
 *   1. the seam: `mapRetentionPlatform` is native-true / web-false;
 *   2. the wiring: AppShell passes it lazily, pinned by source read because this package has no RN
 *      renderer;
 *   3. the safety invariant: a retained map is acceptable only because an opaque base body is painted over
 *      it, so `renderBaseBody` must stay the exact complement of the unretained `mountMap`.
 * The pure behaviour of `retainMap` is pinned in portrait-shell.test.ts and not restated here.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { portraitShellPlan } from "../bodyLayout"
import { MAP_IS_RETAINED } from "../mapRetentionPlatform"
import { MAP_IS_RETAINED as MAP_IS_RETAINED_NATIVE } from "../mapRetentionPlatform.native"
import { MAP_IS_RETAINED as MAP_IS_RETAINED_WEB } from "../mapRetentionPlatform.web"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const appShell = read("../AppShell.tsx")

/** Every compact base view the dock + Search can put on screen. */
const VIEWS = ["home", "map", "messaging", "report", "search", "social"] as const

describe("the mapRetentionPlatform seam", () => {
  it("is native-only, with the bare module defaulting to the web answer", () => {
    // The extension-less module is what tsc, vitest and any bundler that resolves neither extension
    // land on, so it must be the web answer itself.
    expect(MAP_IS_RETAINED).toBe(false)
    expect(MAP_IS_RETAINED_WEB).toBe(false)
    expect(MAP_IS_RETAINED_NATIVE).toBe(true)
  })
})

describe("AppShell fires it", () => {
  it("passes the flag into portraitShellPlan's retainMap argument", () => {
    // If this call loses its fourth argument every assertion below still passes and the map is rebuilt.
    expect(appShell).toContain('import { MAP_IS_RETAINED } from "./mapRetentionPlatform"')
    expect(appShell).toContain(
      "portraitShellPlan(baseView, active, fullPageDetails, mapRetained)",
    )
  })

  it("keeps the CONTROLS out of it - they are chrome, not a hidden surface", () => {
    // `mountMapControls` ignores `retainMap` by construction, and the controls call site must keep passing
    // the three-argument form so it stays that way even if that ever changes.
    expect(appShell).toContain("portraitShellPlan(view, active, fullPageDetails).mountMapControls")
  })

  it("derives `fullPageDetails` from the platform flag OR a seeded deep link, and passes THAT", () => {
    // A cold-loaded /cleanups/<id> renders as a page on compact web too, so only the nav store's
    // `seededDetailPage` can raise the flag on web; on native the constant is already true.
    expect(appShell).toContain(
      "const seededDetailPage = useNavStore((state) => state.seededDetailPage)",
    )
    expect(appShell).toContain(
      'const fullPageDetails = DETAILS_ARE_FULL_PAGE || (mode === "compact" && seededDetailPage)',
    )
    // The shell that MOUNTS the page stack must read the same derived value, not the constant: the plan
    // and the frame would otherwise disagree about which layer owns the body.
    expect(appShell).toContain("fullPageDetails={fullPageDetails}")
  })

  it("LATCHES it lazily instead of passing the platform flag straight through", () => {
    // The app boots into `home`, so passing MAP_IS_RETAINED directly would build a MapLibre surface and
    // fire its first bbox fetch during cold start. The latch trips on the first frame a map is mounted.
    expect(appShell).toContain("const [mapRetained, setMapRetained] = React.useState(false)")
    expect(appShell).toMatch(/if \(MAP_IS_RETAINED && mountMap\) setMapRetained\(true\)/)
    // Gated on the flag, not just `mountMap`, so web never pays an extra state flip and re-render.
    expect(appShell).not.toMatch(/if \(mountMap\) setMapRetained\(true\)/)
  })

  it("leaves web byte-identical: the latch can only ever be false there", () => {
    expect(MAP_IS_RETAINED).toBe(false)
    for (const view of VIEWS) {
      expect(portraitShellPlan(view, null, false, MAP_IS_RETAINED), view).toEqual(
        portraitShellPlan(view, null, false),
      )
    }
  })
})

describe("the retained map is always covered", () => {
  it("draws an opaque base body on every view the retention keeps it mounted for", () => {
    // The only reason hiding may stand in for unmounting: the retained map sits at z0 under
    // `styles.opaqueSurface`, so a view that retains the map but renders no base body would show it.
    for (const view of VIEWS) {
      const retained = portraitShellPlan(view, null, false, true)
      expect(retained.mountMap, view).toBe(true)
      const showsMapItself = portraitShellPlan(view, null, false, false).mountMap
      // Either the view IS the map (nothing to cover), or a base body covers it. Never neither.
      expect(showsMapItself || retained.renderBaseBody, view).toBe(true)
    }
  })

  it("holds under the page seam too (the two flags are orthogonal)", () => {
    // A full-page detail changes the overlay layer, never the base surface, so the cover survives.
    for (const view of VIEWS) {
      expect(portraitShellPlan(view, null, true, true).renderBaseBody, view).toBe(
        portraitShellPlan(view, null, false, false).renderBaseBody,
      )
    }
  })
})
