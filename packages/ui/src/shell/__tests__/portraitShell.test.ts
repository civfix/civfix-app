import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import { reportFlowSource } from "../../bodies/reportFlow/__tests__/reportFlowSource"
import type { DetailEntry, View } from "../../nav"
import {
  SEARCH_REVEAL_EXIT_WINDOW,
  SEARCH_REVEAL_WINDOW,
  effectiveBaseView,
  portraitDockVisible,
  portraitShellPlan,
  portraitSurfaceTransitionKey,
  reportDraftStartsFresh,
  searchRevealExitStyle,
  searchRevealStyle,
  topmostFullEntry,
} from "../bodyLayout"
import type { PortraitDetailPresentation } from "../bodyLayout"

const plan = (view: View, active: DetailEntry | null) => portraitShellPlan(view, active)
const transitionKey = (
  view: View,
  active: DetailEntry | null,
  presentation: PortraitDetailPresentation,
) => portraitSurfaceTransitionKey(view, active, presentation)

describe("portrait dock visibility", () => {
  it("hides the web dock while the sheet is mounted, including its closing slide", () => {
    expect(portraitDockVisible(true, true, false, false)).toBe(true)
    expect(portraitDockVisible(true, true, true, true)).toBe(false)
    expect(portraitDockVisible(true, true, false, true)).toBe(false)
    expect(portraitDockVisible(true, false, true, true)).toBe(false)
  })

  it("keeps the native dock up whenever the chrome or the sheet is showing", () => {
    expect(portraitDockVisible(false, false, false, false)).toBe(false)
    expect(portraitDockVisible(false, true, false, false)).toBe(true)
    expect(portraitDockVisible(false, false, true, true)).toBe(true)
    expect(portraitDockVisible(false, false, false, true)).toBe(true)
  })
})

describe("portrait shell layer plan", () => {
  it.each(["home", "messaging", "search"] as const)(
    "renders %s as a standalone body without map layers",
    (view) => {
      expect(plan(view, null)).toEqual({
        mountMap: false,
        mountMapControls: false,
        renderBaseBody: true,
        detailPresentation: "none",
        bottomChromeVisible: true,
        surfaceKeyboardAvoidance: false,
      })
    },
  )

  it("mounts the map and controls only for the bare Map tab", () => {
    expect(plan("map", null)).toEqual({
      mountMap: true,
      mountMapControls: true,
      renderBaseBody: false,
      detailPresentation: "none",
      bottomChromeVisible: true,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("renders the Report tab as a full-screen base body with no map mounted and the dock visible", () => {
    expect(plan("report", null)).toEqual({
      mountMap: false,
      mountMapControls: false,
      renderBaseBody: true,
      detailPresentation: "none",
      bottomChromeVisible: true,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("presents scroll details as sheets above their current body and HIDES the dock (the sheet covers it)", () => {
    expect(plan("home", { kind: "profile" })).toEqual({
      mountMap: false,
      mountMapControls: false,
      renderBaseBody: true,
      detailPresentation: "sheet",
      bottomChromeVisible: false,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("keeps the Map tab mounted beneath a scroll detail sheet but still hides the dock", () => {
    expect(plan("map", { kind: "cleanup", id: "event-1" })).toEqual({
      mountMap: true,
      mountMapControls: true,
      renderBaseBody: false,
      detailPresentation: "sheet",
      bottomChromeVisible: false,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("presents the composer detail as a full overlay that owns keyboard avoidance", () => {
    expect(plan("home", { kind: "composer" })).toEqual({
      mountMap: false,
      mountMapControls: false,
      renderBaseBody: true,
      detailPresentation: "full",
      bottomChromeVisible: false,
      surfaceKeyboardAvoidance: true,
    })
  })

  it("presents the post-thread detail as a full overlay whose keyboard inset the body owns", () => {
    expect(plan("home", { kind: "post-thread", id: "post-1" })).toEqual({
      mountMap: false,
      mountMapControls: false,
      renderBaseBody: true,
      detailPresentation: "full",
      bottomChromeVisible: false,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("presents the person profile as a full overlay page with no dock and no shell keyboard inset", () => {
    expect(plan("social", { kind: "person", id: "p" })).toEqual({
      mountMap: false,
      mountMapControls: false,
      renderBaseBody: true,
      detailPresentation: "full",
      bottomChromeVisible: false,
      surfaceKeyboardAvoidance: false,
    })
  })

  it("keeps the dock visible on the Report tab but hides it under full detail pages", () => {
    expect(plan("report", null).bottomChromeVisible).toBe(true)
    expect(plan("home", { kind: "composer" }).bottomChromeVisible).toBe(false)
    expect(plan("home", { kind: "post-thread", id: "post-1" }).bottomChromeVisible).toBe(false)
    expect(plan("social", { kind: "person", id: "p" }).bottomChromeVisible).toBe(false)
  })

  it("NEVER shows the bottom chrome while a detail presents as a sheet, whatever the view", () => {
    const sheetKinds = [
      { kind: "profile" as const },
      { kind: "pin" as const, id: "r1" },
      { kind: "cleanup" as const, id: "e1" },
      { kind: "create-cleanup" as const },
      { kind: "drop-pin" as const, lat: 1, lng: 2 },
    ]
    for (const view of ["home", "map", "messaging", "report", "search"] as const) {
      for (const active of sheetKinds) {
        const result = plan(view, active)
        expect(result.detailPresentation).toBe("sheet")
        expect(result.bottomChromeVisible).toBe(false)
      }
    }
  })

  it("is byte-identical when the page seam is passed explicitly false", () => {
    const kinds: (DetailEntry | null)[] = [
      null,
      { kind: "profile" },
      { kind: "pin", id: "r1" },
      { kind: "create-cleanup" },
      { kind: "drop-pin", lat: 1, lng: 2 },
      { kind: "composer" },
      { kind: "post-thread", id: "post-1" },
      { kind: "person", id: "p" },
    ]
    for (const view of ["home", "map", "messaging", "report", "search", "social"] as const) {
      for (const active of kinds) {
        expect(portraitShellPlan(view, active, false), `${view} / ${active?.kind}`).toEqual(
          plan(view, active),
        )
      }
    }
  })
})

describe("topmostFullEntry (the overlay layer is owned by the STACK, not the active entry)", () => {
  it("keeps the composer as the overlay while its host-an-event pull-up rides above it", () => {
    expect(topmostFullEntry([{ kind: "composer" }, { kind: "create-cleanup" }])).toEqual({
      kind: "composer",
    })
  })

  it("returns null when the stack holds no full body", () => {
    expect(topmostFullEntry([])).toBeNull()
    expect(topmostFullEntry([{ kind: "profile" }, { kind: "pin", id: "r1" }])).toBeNull()
    expect(topmostFullEntry([{ kind: "view", view: "map" }])).toBeNull()
  })

  it("picks the TOPMOST full body, so the newest overlay wins", () => {
    expect(
      topmostFullEntry([
        { kind: "composer" },
        { kind: "create-cleanup" },
        { kind: "post-thread", id: "post-9" },
      ]),
    ).toEqual({ kind: "post-thread", id: "post-9" })
    expect(
      topmostFullEntry([
        { kind: "composer" },
        { kind: "post-thread", id: "post-9" },
        { kind: "profile" },
      ]),
    ).toEqual({ kind: "post-thread", id: "post-9" })
  })

  it("resolves a person profile as the overlay - the whole reason its child navigations work", () => {
    expect(topmostFullEntry([{ kind: "person", id: "p" }])).toEqual({ kind: "person", id: "p" })
    expect(topmostFullEntry([{ kind: "person", id: "p" }, { kind: "cleanup", id: "e1" }])).toEqual({
      kind: "person",
      id: "p",
    })
  })
})

describe("portrait surface transition identity", () => {
  it("keys independent tab surfaces by view", () => {
    expect(transitionKey("home", null, "none")).toBe("view:home")
    expect(transitionKey("search", null, "none")).toBe("view:search")
  })

  it("keys full overlays by their route identity", () => {
    expect(transitionKey("home", { kind: "post-thread", id: "post-1" }, "full")).toBe(
      "post-thread:post-1:::::",
    )
    expect(
      transitionKey(
        "home",
        { kind: "composer", composerMode: "quote", targetPostId: "post-1" },
        "full",
      ),
    ).toBe("composer:quote:post-1")
    expect(transitionKey("social", { kind: "person", id: "p" }, "full")).toBe("person:p:::::")
  })

  it("keeps the base transition key stable beneath a detail sheet", () => {
    expect(transitionKey("home", { kind: "profile" }, "sheet")).toBe("view:home")
  })
})

describe("search body sync (dock-morph rebuild, defects 4/5)", () => {
  it("keeps the base surface on the view Search was opened from when Search is an overlay (native)", () => {
    expect(effectiveBaseView("search", "map", true)).toBe("map")
    expect(effectiveBaseView("search", "home", true)).toBe("home")
    expect(effectiveBaseView("map", "home", true)).toBe("map")
    expect(effectiveBaseView("messaging", "map", true)).toBe("messaging")
  })

  it("collapses to identity on web (searchIsOverlay=false) so the web shell is byte-unchanged", () => {
    expect(effectiveBaseView("search", "map", false)).toBe("search")
    expect(effectiveBaseView("home", "map", false)).toBe("home")
    expect(effectiveBaseView("map", "home", false)).toBe("map")
  })

  it("mounts the map (base plan) when Search rides over the Map view, so exit reveals an already-positioned map", () => {
    expect(portraitShellPlan(effectiveBaseView("search", "map", true), null).mountMap).toBe(true)
    expect(portraitShellPlan(effectiveBaseView("search", "home", true), null).mountMap).toBe(false)
    expect(portraitShellPlan(effectiveBaseView("search", "home", true), null).renderBaseBody).toBe(true)
  })

  it("fades + slides the search overlay in over the morph window, matched to the dock", () => {
    expect(SEARCH_REVEAL_WINDOW).toEqual([0.3, 0.8])
    expect(searchRevealStyle(0)).toEqual({ opacity: 0, translateY: 12 })
    expect(searchRevealStyle(0.3)).toEqual({ opacity: 0, translateY: 12 })
    expect(searchRevealStyle(1)).toEqual({ opacity: 1, translateY: 0 })
    expect(searchRevealStyle(0.8)).toEqual({ opacity: 1, translateY: 0 })
    const mid = searchRevealStyle(0.55)
    expect(mid.opacity).toBeCloseTo(0.5)
    expect(mid.translateY).toBeCloseTo(6)
  })

  it("fades the search overlay OUT on the MIRROR of the reveal window, so the two curves match", () => {
    expect(SEARCH_REVEAL_EXIT_WINDOW).toEqual([0.2, 0.7])
    expect(searchRevealExitStyle(0.69).opacity).toBeLessThan(1)
    expect(searchRevealExitStyle(0.7)).toEqual({ opacity: 1, translateY: 0 })
    expect(searchRevealExitStyle(1)).toEqual({ opacity: 1, translateY: 0 })
    expect(searchRevealExitStyle(0.2)).toEqual({ opacity: 0, translateY: 12 })
    expect(searchRevealExitStyle(0)).toEqual({ opacity: 0, translateY: 12 })
    expect(searchRevealExitStyle(0.45).opacity).toBeCloseTo(0.5)
  })
})

describe("the report tab's un-Modal'd map pick layer (WS3 3b)", () => {
  const pickStepSource = readFileSync(
    new URL("../../map/PortraitMapPickStep.native.tsx", import.meta.url),
    "utf8",
  )
  const reportSource = readFileSync(
    new URL("../../bodies/ReportFlowBody.tsx", import.meta.url),
    "utf8",
  )

  it("presents as an absolute-fill LAYER when the caller asks for one, and keeps the Modal otherwise", () => {
    expect(pickStepSource).toContain('presentation = "modal"')
    expect(pickStepSource).toContain('presentation === "layer"')
  })

  it("arms the sheet-detent capture/restore ONLY for the modal presentation", () => {
    expect(pickStepSource).toContain(
      'usePickStepSheetSnap(visible && presentation === "modal")',
    )
  })

  it("renders the report wizard's pick layer OUTSIDE its shared vertical ScrollView", () => {
    const scrollClose = reportSource.lastIndexOf("</ScrollView>")
    const pickLayer = reportSource.indexOf("<PortraitMapPickStep")
    expect(scrollClose).toBeGreaterThan(0)
    expect(pickLayer).toBeGreaterThan(scrollClose)
    expect(reportSource).toContain('presentation="layer"')
  })

  it("registers an Android hardware-back handler for the LAYER path only, wired to cancel", () => {
    expect(pickStepSource).toContain("BackHandler")
    expect(pickStepSource).toContain('"hardwareBackPress"')
    expect(pickStepSource).toContain("if (!layered || !visible || inert) return")
  })
})

describe("the Report tab keeps the dock for the WHOLE flow (WS3)", () => {
  const reportSource = readFileSync(
    new URL("../../bodies/ReportFlowBody.tsx", import.meta.url),
    "utf8",
  )
  const pickStepSource = readFileSync(
    new URL("../../map/PortraitMapPickStep.native.tsx", import.meta.url),
    "utf8",
  )

  it("relies on the base surface's tab-bar footprint rather than insetting either layer itself", () => {
    const viewfinder = /viewfinderLayer: \{[^}]*\}/.exec(reportSource)?.[0] ?? ""
    expect(viewfinder).toContain("flex: 1")
    expect(viewfinder).not.toContain("padding")

    const layer = /\n {2}layer: \{[^}]*\}/.exec(pickStepSource)?.[0] ?? ""
    expect(layer).toContain("StyleSheet.absoluteFillObject")
    expect(layer).not.toContain("padding")
    expect(pickStepSource).toContain('const topOffset = (layered ? 0 : insets.top) + space["2"]')
    expect(pickStepSource).toContain(
      'const bottomOffset = (layered ? 0 : insets.bottom) + space["3"]',
    )
  })
})

describe("the Report tab's keep-alive slot", () => {
  const portrait = readFileSync(new URL("../PortraitShell.shared.tsx", import.meta.url), "utf8")

  it("leaves portraitShellPlan's SHAPE untouched - the slot adds no plan field", () => {
    expect(Object.keys(plan("report", null)).sort()).toEqual(
      [
        "bottomChromeVisible",
        "detailPresentation",
        "mountMap",
        "mountMapControls",
        "renderBaseBody",
        "surfaceKeyboardAvoidance",
      ].sort(),
    )
    expect(plan("report", null).renderBaseBody).toBe(true)
    expect(plan("report", null).bottomChromeVisible).toBe(true)
  })

  it("serves the report body from the retained slot INSTEAD of the BodyTransition swap (never both)", () => {
    expect(portrait).toMatch(/frame\.base\.bodyMounted && !reportSlotVisible/)
    expect(portrait).toMatch(/const reportSlotBody = useMemo\(\(\) => renderBody\(null, "report"\), \[renderBody\]\)/)
  })

  it("HIDES the slot with opacity, never display:none (Fabric culls display:none native views, remounting the camera)", () => {
    expect(portrait).not.toMatch(/display: "none"/)
    expect(portrait).toMatch(/reportSlotVisible \? null : styles\.keepAliveHidden/)
    expect(portrait).toMatch(/pointerEvents=\{reportSlotVisible \? "auto" : "none"\}/)
    expect(portrait).toMatch(/accessibilityElementsHidden=\{!reportSlotVisible\}/)
    expect(portrait).toMatch(
      /importantForAccessibility=\{reportSlotVisible \? "auto" : "no-hide-descendants"\}/,
    )
  })

  it("keeps the slot under the ONE base scroll host (a second host would remount what it retains)", () => {
    expect(portrait).toMatch(/const baseScrollHost = PORTRAIT_BASE_SCROLL_HOST\b/)
    const hostBlock = sliceBetween(portrait, "<ScrollHostProvider value={baseScrollHost}>", "</ScrollHostProvider>")
    expect(hostBlock).toMatch(/reportSlotMounted \?/)
    expect(hostBlock.indexOf("<BodyTransition")).toBeLessThan(hostBlock.indexOf("reportSlotMounted ?"))
  })

  it("remounts a STALE wizard on entry only - never while the tab is on screen", () => {
    expect(portrait).toMatch(/useDraftReportStore\.subscribe\(/)
    expect(portrait).toMatch(/reportDraftStartsFresh\(state\.draft\.media\.length\)/)
    expect(portrait).toMatch(/if \(baseView === "report" && reportSlotStale\.current\)/)
    expect(portrait).toMatch(/key=\{`report:\$\{reportSlotGeneration\}`\}/)
  })

  it("leaves NO hardware-Back consumer armed while the slot is detached (the BackHandler regression)", () => {
    const report = reportFlowSource()
    expect(report).toContain("const pickLayerOpen = pickLayerVisible(picking, stackNonEmpty, runActive)")
    expect(report).toContain("const stackNonEmpty = useNavStore((s) => s.stack.length > 0)")
    expect(report).toContain('const runActive = useNavStore((s) => s.view === "report")')
    expect(report).toContain("visible={pickLayerMounted}")
    expect(report).toContain("inert={!pickLayerOpen}")
    expect(report).toContain(
      "const pickLayerMounted = pickLayerOpen || (pickLingerArmed && pickLayerOffViewHold)",
    )
    expect(report).toContain('const PICK_LAYER_LINGERS = Platform.OS !== "web"')
    expect(report).toContain(
      "PICK_LAYER_LINGERS && pickLayerVisible(picking, stackNonEmpty, true) && !runActive",
    )
    const pickStep = readFileSync(
      new URL("../../map/PortraitMapPickStep.native.tsx", import.meta.url),
      "utf8",
    )
    expect(pickStep).toContain("if (!layered || !visible || inert) return")
    expect(pickStep).toContain("if (!visible) return null")
    const pickStepWeb = readFileSync(
      new URL("../../map/PortraitMapPickStep.web.tsx", import.meta.url),
      "utf8",
    )
    expect(pickStepWeb).toContain("const live = visible && !inert")
    expect(pickStepWeb).toContain('if (!live || typeof document === "undefined") return null')
    expect(report).toContain("viewfinderSessionActive(activeStep, viewfinderMounted, stackNonEmpty, runActive)")
  })

  it("classes every fresh-start draft publication as stale, and a working draft as resumable", () => {
    expect(reportDraftStartsFresh(0)).toBe(true)
    expect(reportDraftStartsFresh(1)).toBe(false)
    expect(reportDraftStartsFresh(5)).toBe(false)
  })
})

describe("the home + messages keep-alive slots", () => {
  const portrait = readFileSync(new URL("../PortraitShell.shared.tsx", import.meta.url), "utf8")

  it("serves home and messaging from retained slots INSTEAD of the BodyTransition swap (never both)", () => {
    expect(portrait).toMatch(
      /frame\.base\.bodyMounted && !reportSlotVisible && !homeSlotVisible && !messagingSlotVisible/,
    )
    expect(portrait).toContain(
      'const homeSlotVisible = RETAIN_TAB_BODIES && frame.base.bodyMounted && baseView === "home"',
    )
    expect(portrait).toContain(
      'const messagingSlotVisible = RETAIN_TAB_BODIES && frame.base.bodyMounted && baseView === "messaging"',
    )
    expect(portrait).toMatch(/const homeSlotBody = useMemo\(\(\) => renderBody\(null, "home"\), \[renderBody\]\)/)
    expect(portrait).toMatch(
      /const messagingSlotBody = useMemo\(\(\) => renderBody\(null, "messaging"\), \[renderBody\]\)/,
    )
  })

  it("HIDES the list slots with opacity 0 (layout kept, so re-show pays no relayout) and keeps them un-keyed", () => {
    expect(portrait).toMatch(/homeSlotVisible \? null : styles\.keepAliveHidden/)
    expect(portrait).toMatch(/messagingSlotVisible \? null : styles\.keepAliveHidden/)
    expect(portrait).toMatch(/pointerEvents=\{homeSlotVisible \? "auto" : "none"\}/)
    expect(portrait).toMatch(/pointerEvents=\{messagingSlotVisible \? "auto" : "none"\}/)
    expect(portrait).toMatch(/accessibilityElementsHidden=\{!homeSlotVisible\}/)
    expect(portrait).toMatch(/accessibilityElementsHidden=\{!messagingSlotVisible\}/)
    expect(portrait).toMatch(/keepAliveHidden: \{\s*opacity: 0,\s*pointerEvents: "none",\s*\}/)
    expect(portrait).toMatch(/<PageActiveProvider value=\{homeSlotVisible\}>/)
    expect(portrait).toMatch(/<PageActiveProvider value=\{messagingSlotVisible\}>/)
    expect(portrait).not.toMatch(/key=\{`home:/)
    expect(portrait).not.toMatch(/key=\{`messaging:/)
  })

  it("mounts both slots INSIDE the transition host, so the view-keyed entrance still plays", () => {
    const open = portrait.indexOf("<BodyTransition")
    const close = portrait.indexOf("</BodyTransition>")
    expect(open).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(open)
    const hostChildren = portrait.slice(open, close)
    expect(hostChildren).toMatch(/homeSlotMounted \?/)
    expect(hostChildren).toMatch(/messagingSlotMounted \?/)
    expect(hostChildren).not.toMatch(/reportSlotMounted \?/)
  })

  it("is NATIVE-ONLY and pre-warms on STAGGERED clocks through the one shared slot hook", () => {
    expect(portrait).toContain('const RETAIN_TAB_BODIES = Platform.OS !== "web"')
    expect(portrait).toContain("const HOME_PREWARM_DELAY_MS = 3400")
    expect(portrait).toContain("const MESSAGING_PREWARM_DELAY_MS = 3800")
    expect(portrait).toMatch(
      /useKeepAliveSlotMounted\(\s*homeSlotVisible,\s*RETAIN_TAB_BODIES,\s*HOME_PREWARM_DELAY_MS,\s*\)/,
    )
    expect(portrait).toMatch(
      /useKeepAliveSlotMounted\(\s*messagingSlotVisible,\s*RETAIN_TAB_BODIES,\s*MESSAGING_PREWARM_DELAY_MS,\s*\)/,
    )
    expect(portrait).toMatch(/if \(!retained \|\| mounted\) return/)
    expect(portrait).toContain("return () => clearTimeout(handle)")
  })

  it("mounts a slot in the same commit it becomes visible, never a frame later", () => {
    const body = sliceBetween(portrait, "function useKeepAliveSlotMounted(", "\n}\n")
    expect(body).toMatch(/return mounted \|\| visible\s*$/)
  })
})

describe("retaining the map across compact tab switches (`retainMap`)", () => {
  it("defaults OFF, so every existing call site is byte-identical", () => {
    for (const view of ["home", "map", "messaging", "report", "search", "social"] as const) {
      expect(portraitShellPlan(view, null, false, false), view).toEqual(plan(view, null))
    }
  })

  it("keeps the map MOUNTED for every view when it is on - and moves nothing else", () => {
    for (const view of ["home", "map", "messaging", "report", "search", "social"] as const) {
      const retained = portraitShellPlan(view, null, false, true)
      expect(retained.mountMap, view).toBe(true)
      expect(retained.mountMapControls, view).toBe(plan(view, null).mountMapControls)
      expect(retained.renderBaseBody, view).toBe(plan(view, null).renderBaseBody)
      expect(retained.bottomChromeVisible, view).toBe(plan(view, null).bottomChromeVisible)
      expect(retained.detailPresentation, view).toBe(plan(view, null).detailPresentation)
    }
  })

  it("is orthogonal to the page seam - the two flags never read each other", () => {
    for (const view of ["home", "map", "report"] as const) {
      expect(portraitShellPlan(view, null, true, true).mountMap, view).toBe(true)
      expect(portraitShellPlan(view, null, true, true).bottomChromeVisible, view).toBe(
        portraitShellPlan(view, null, true, false).bottomChromeVisible,
      )
    }
  })
})

describe("every shell host navigates in the SAME motion language (source-pinned)", () => {
  const hosts = {
    "PortraitShell.shared.tsx": readFileSync(
      new URL("../PortraitShell.shared.tsx", import.meta.url),
      "utf8",
    ),
    "CompactShell.native.tsx": readFileSync(
      new URL("../CompactShell.native.tsx", import.meta.url),
      "utf8",
    ),
    "CompactShell.web.tsx": readFileSync(new URL("../CompactShell.web.tsx", import.meta.url), "utf8"),
    "ExpandedShell.tsx": readFileSync(new URL("../ExpandedShell.tsx", import.meta.url), "utf8"),
    "PageStack.web.tsx": readFileSync(new URL("../PageStack.web.tsx", import.meta.url), "utf8"),
  }

  it("derives push vs pop from the STACK LENGTH, through the one shared derivation", () => {
    for (const [name, src] of Object.entries(hosts)) {
      if (name === "PageStack.web.tsx") {
        expect(src, name).toMatch(/webPageTransitionPlan\(\s*direction,/)
        continue
      }
      expect(src, name).toContain("useStackDirection")
      expect(src, name).toMatch(/useStackDirection\((stack|held\.stack)\.length\)/)
    }
  })

  it("hands that direction to the body transition, never a hardcoded one", () => {
    for (const [name, src] of Object.entries(hosts)) {
      if (name === "PortraitShell.shared.tsx") {
        expect(src, name).toMatch(/direction=\{direction\}/)
        continue
      }
      if (name === "PageStack.web.tsx") {
        expect(src, name).toMatch(/webPageTransitionPlan\(\s*direction,/)
        expect(src, name).not.toMatch(/<BodyTransition\b/)
        continue
      }
      expect(src, name).toMatch(/<BodyTransition transitionKey=\{\w+\} direction=\{direction\}>/)
    }
    for (const [name, src] of Object.entries(hosts)) {
      expect(src, name).not.toMatch(/direction="(push|pop|replace)"/)
    }
  })

  it("keeps the native page stack the ONLY host that owns a page-level gesture", () => {
    expect(hosts["PageStack.web.tsx"]).not.toMatch(/Gesture\.\w/)
    expect(hosts["PortraitShell.shared.tsx"]).toMatch(/<PageStack/)
  })
})

describe("PortraitShell.web: the top inset counts the notch once", () => {
  const src = readFileSync(new URL("../PortraitShell.web.tsx", import.meta.url), "utf8")

  it("takes the larger of the safe-area top and a banner that already pads for it", () => {
    expect(src).toContain("topInset={Math.max(insets.top, bannerHeight)}")
    expect(src).not.toMatch(/insets\.top \+ bannerHeight/)
  })
})

describe("web bottom safe area: the page box reserve owns it, the reply dock does not add it again", () => {
  const dock = readFileSync(new URL("../../bodies/thread/useReplyDockInset.ts", import.meta.url), "utf8")
  const shell = readFileSync(new URL("../PortraitShell.web.tsx", import.meta.url), "utf8")
  const pages = readFileSync(new URL("../PageStack.web.tsx", import.meta.url), "utf8")

  it("reserves the inset on the pinned-footer page box and rests the dock at zero on web", () => {
    expect(shell).toContain("bottomSafeArea={insets.bottom}")
    expect(pages).toContain('const boxReserve = reserve === "box" ? paddingBottom : 0')
    expect(dock).toContain('const restingSafeArea = Platform.OS === "web" ? 0 : (insets?.bottom ?? 0)')
    expect(dock).toContain("restPad: inset > 0 ? 0 : restingSafeArea")
  })
})
