/**
 * MAP RETENTION, FIRED (tab-lag fix, issue 1 - the second half).
 *
 * `portraitShellPlan`'s `retainMap` argument shipped implemented-but-unpassed; this file is the guard for
 * the pass that actually turns it on. Its assertions come in three layers, because the retention only works
 * if all three hold and each is independently deletable:
 *
 *   1. THE SEAM. `mapRetentionPlatform` is native-true / web-false, like its two siblings.
 *   2. THE WIRING. AppShell passes it, LAZILY. The whole no-regression argument for web, and the whole
 *      no-cold-start-cost argument for native, live in ~4 lines of that file, so they are pinned by source
 *      read - this package has no RN renderer, which is the same reason portrait-shell.test.ts pins the
 *      keep-alive slot that way.
 *   3. THE SAFETY INVARIANT. A retained map is only acceptable because something opaque is painted over it.
 *      That is `renderBaseBody`, and it must stay the exact complement of the UNretained `mountMap` - i.e.
 *      the retention may never open a view that shows a hidden map through a gap.
 *
 * The pure-behaviour half of `retainMap` (it moves `mountMap` and nothing else) is pinned next door in
 * portrait-shell.test.ts's "retaining the map across compact tab switches" block; this file deliberately
 * does not restate it, and asserts the FIRING that block was written before.
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
    // Same shape as detailPresentationPlatform / searchRevealPlatform: the extension-less module is what
    // tsc, vitest and any bundler that resolves neither extension land on, so it must BE the web answer -
    // the `.web` sibling is belt and braces, not the source of the default.
    expect(MAP_IS_RETAINED).toBe(false)
    expect(MAP_IS_RETAINED_WEB).toBe(false)
    expect(MAP_IS_RETAINED_NATIVE).toBe(true)
  })
})

describe("AppShell fires it", () => {
  it("passes the flag into portraitShellPlan's retainMap argument", () => {
    // The one edit that turns the parameter from decoration into behaviour. If this line loses its fourth
    // argument, every assertion below still passes and the app silently goes back to rebuilding the map.
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
    // The third argument stopped being the bare platform constant when a cold-loaded /cleanups/<id> had
    // to render as a page on compact web too. It is still the constant on native (where it is already
    // true, so the OR is the identity) and still false on web for every IN-APP open - only the nav
    // store's `seededDetailPage` can raise it there, and only while the shell is compact.
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
    // The app boots into `home`, not `map` (useNavStore's initial view). Passing MAP_IS_RETAINED directly
    // would therefore build a MapLibre surface - and fire its first /map/reports bbox fetch - during cold
    // start, for a user who may never open the Map tab: paying for a tab switch that never happens. The
    // latch trips on the first frame a map is actually mounted and is never released.
    expect(appShell).toContain("const [mapRetained, setMapRetained] = React.useState(false)")
    expect(appShell).toMatch(/if \(MAP_IS_RETAINED && mountMap\) setMapRetained\(true\)/)
    // Gated on the FLAG, not just on `mountMap`: on web the setter must never be called at all, or the web
    // shell picks up an extra state flip + re-render it does not have today.
    expect(appShell).not.toMatch(/if \(mountMap\) setMapRetained\(true\)/)
  })

  it("leaves web byte-identical: the latch can only ever be false there", () => {
    // `mapRetained` starts false and the only setter is behind MAP_IS_RETAINED, so on web
    // `portraitShellPlan(..., false)` is the historic three-argument call exactly.
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
    // THE SAFETY INVARIANT, and the only reason hiding is allowed to stand in for unmounting. The retained
    // instance sits at z0; PortraitShell.shared paints `styles.opaqueSurface` for any mounted base body, so
    // a view that both retains the map AND renders no base body would show a live map nobody asked for.
    for (const view of VIEWS) {
      const retained = portraitShellPlan(view, null, false, true)
      expect(retained.mountMap, view).toBe(true)
      const showsMapItself = portraitShellPlan(view, null, false, false).mountMap
      // Either the view IS the map (nothing to cover), or a base body covers it. Never neither.
      expect(showsMapItself || retained.renderBaseBody, view).toBe(true)
    }
  })

  it("holds under the page seam too (the two flags are orthogonal)", () => {
    // Converting a detail kind to a full page changes the OVERLAY layer, never the base surface, so the
    // cover survives the conversion waves. Cheap to state, and it is the thing that would quietly rot.
    for (const view of VIEWS) {
      expect(portraitShellPlan(view, null, true, true).renderBaseBody, view).toBe(
        portraitShellPlan(view, null, false, false).renderBaseBody,
      )
    }
  })
})
