import { readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import {
  DOCK_OCCLUSION_SINK,
  DOCK_SHEET_CLEAR,
  DOCK_SHEET_COVERED,
  dockOcclusionFromSheet,
  SCHEDULE,
  TAB_ANIMATION_MS,
  TAB_SPECS,
  activeTabIndex,
  clearMorph,
  compactBottomChrome,
  DOCK_BOTTOM_MARGIN,
  dockBottomGap,
  exitTabId,
  initialTabBarFootprint,
  lockedIndexForPillCenter,
  PILL_DRAG_RESISTANCE,
  pillDragRect,
  placeholderMorph,
  resolvePreviousView,
  resolveTabBarFootprint,
  searchMorphTarget,
  searchRiseTransition,
  sheetSnapPoints,
  SHEET_REF_SCREEN,
  SHEET_REF_PEEK,
  SHEET_REF_MID,
  SHEET_REF_FULL,
  seedPreviousView,
  selectedPillRect,
  tabDividerRect,
  tabIconMorph,
  tabPillTransition,
  travelFactor,
  windowProgress,
  TAB_PILL_INSET_X,
  TAB_ICON_CENTER_Y,
  TAB_ICON_SIZE,
  TAB_ICON_STROKE_WIDTH,
  TAB_PILL_INSET_Y,
} from "../tabBarLogic"
import { DOCK_H } from "../../surface/liquidGlass/liquidGlassModel"
import { useTabBarStore } from "../tabBarStore"
import { useSearchBarStore } from "../searchBarStore"

beforeEach(() => useTabBarStore.setState({ tabBarHeight: 0, lastNonSearchView: "home" }))

describe("map-first tab bar model", () => {
  it("contains Map, Home, Messages, and the Report view tab in order (no always-coral accent flag)", () => {
    expect(TAB_SPECS).toEqual([
      { id: "map", view: "map" },
      { id: "home", view: "home" },
      { id: "messages", view: "messaging" },
      { id: "report", view: "report" },
    ])
  })

  it("tracks the active view tab (incl. Report) while search has no active pill", () => {
    expect(activeTabIndex("map")).toBe(0)
    expect(activeTabIndex("home")).toBe(1)
    expect(activeTabIndex("messaging")).toBe(2)
    expect(activeTabIndex("report")).toBe(3)
    expect(activeTabIndex("search")).toBe(-1)
  })

  it("disables the pill transition when reduced motion is requested", () => {
    expect(tabPillTransition(true)).toBe("none")
    expect(tabPillTransition(false)).toContain(`${TAB_ANIMATION_MS}ms`)
  })

  it("replaces the normal tabs with docked search chrome in Search", () => {
    expect(compactBottomChrome("search")).toBe("docked-search")
    expect(compactBottomChrome("home")).toBe("tabs")
    expect(compactBottomChrome("map")).toBe("tabs")
  })

  it("enters and leaves the search morph on ONE deterministic timing, with no tail either way", () => {
    for (const recipe of [MOTION.dockMorphIn, MOTION.dockMorphOut]) {
      expect(recipe.duration).toBe(200)
      expect(recipe.easing).toEqual([0.22, 1, 0.36, 1])
      expect(recipe.duration).toBeLessThanOrEqual(MOTION.tabPill.duration)
    }
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).not.toContain("withSpring")
    expect(native).toMatch(/withTiming\(target, \{ \.\.\.dockMorphInConfig\(\)/)
    expect(native).toMatch(/withTiming\(target, \{ \.\.\.dockMorphOutConfig\(\)/)
    const configs = readFileSync(new URL("../motionConfigs.native.ts", import.meta.url), "utf8")
    expect(configs).toContain(
      "export const dockMorphInConfig = (): WithTimingConfig => timingConfig(theme.motion.dockMorphIn)",
    )
  })

  it("renders ICONS-ONLY tab cells (no text labels) with bolder band-centered glyphs", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).not.toMatch(/tabLabel/)
    expect(native).not.toMatch(/LABEL_TOP/)
    expect(native).toMatch(/accessibilityLabel=\{label\}/)
    expect(TAB_ICON_SIZE).toBe(25)
    expect(TAB_ICON_STROKE_WIDTH).toBeCloseTo(2.4)
    expect(TAB_ICON_CENTER_Y).toBe(DOCK_H / 2)
    expect(native).toMatch(/strokeWidth=\{ICON_STROKE\}/)
    const shared = readFileSync(new URL("../TabBar.shared.tsx", import.meta.url), "utf8")
    expect(shared).not.toMatch(/tabLabel/)
  })

  it("gives the home tab a feed glyph, and declares it in exactly one place", () => {
    const shared = readFileSync(new URL("../TabBar.shared.tsx", import.meta.url), "utf8")
    expect(shared).toContain('home: { icon: iconMap.Newspaper, labelKey: "tab.home" }')
    expect(shared).not.toContain("iconMap.Home")
    const rail = readFileSync(new URL("../Rail.tsx", import.meta.url), "utf8")
    const web = readFileSync(new URL("../TabBar.web.tsx", import.meta.url), "utf8")
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    for (const seam of [rail, web, native]) {
      expect(seam, "a seam that names its own tab icons can drift from the other layout").toContain(
        "TabBar.shared",
      )
      expect(seam).not.toMatch(/iconMap\.(Home|Newspaper)/)
    }
  })

  it("puts a camera on the centre tab and opens the report wizard straight from it", () => {
    const shared = readFileSync(new URL("../TabBar.shared.tsx", import.meta.url), "utf8")
    expect(shared).toContain('report: { icon: iconMap.Camera, labelKey: "tab.report" }')
    expect(shared).toContain('import { openReportFlow } from "../bodies/composerCreateFlow"')
    expect(shared).toMatch(/if \(tab\.id === "report"\) \{[\s\S]*?openReportFlow\(\)/)
    for (const locale of ["en", "es", "de", "ko"]) {
      const nav = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${locale}/nav.json`, import.meta.url), "utf8"),
      ) as { tab: { report: string }; create?: unknown; a11y: Record<string, string> }
      expect(typeof nav.tab.report).toBe("string")
      expect(nav.create, `${locale} still ships the create-menu copy`).toBeUndefined()
      expect(nav.a11y.create_menu).toBeUndefined()
      expect(nav.a11y.dismiss_create_menu).toBeUndefined()
    }
  })

  it("keeps no create-menu machinery for the centre tab to grow a bubble back from", () => {
    const dir = fileURLToPath(new URL("..", import.meta.url))
    const left = readdirSync(dir).filter((name) => name.toLowerCase().startsWith("createmenu"))
    expect(left, "a CreateMenu module survived the revert").toEqual([])
    for (const file of ["../TabBar.shared.tsx", "../TabBar.web.tsx", "../TabBar.native.tsx", "../Rail.tsx", "../AppShell.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8")
      expect(source, file).not.toContain("CreateMenu")
      expect(source, file).not.toContain("useTabAnchors")
    }
  })

  it("no longer draws a separate docked-search glass set (one morph owns the shapes)", () => {
    const header = readFileSync(new URL("../SearchHeader.native.tsx", import.meta.url), "utf8")
    expect(header).not.toMatch(/function DockedSearchBar/)
    expect(header).not.toMatch(/BlurSurface/)
    expect(header).toMatch(/export function useDockedSearchRise/)
  })

  it("drives the docked bar's keyboard rise through the canonical anchor, not a raw keyboard height", () => {
    const header = readFileSync(new URL("../SearchHeader.native.tsx", import.meta.url), "utf8")
    expect(header).not.toMatch(/useAnimatedKeyboard/)
    expect(header).toMatch(/useKeyboardAnchor/)
    expect(header).toMatch(/useKeyboardAnchor\(\{\s*enabled: focused,\s*restOffset\s*\}\)/)
    expect(header).toMatch(/setKeyboardReserve\(anchor\.reserved\)/)
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(
      /useDockedSearchRise\(riseRef, dockedSearch\.value, dockKeyboardRestOffset\(insets\.bottom, DOCK_PLATFORM\), searchActive, p\)/,
    )
    expect(header).toMatch(/focusSettleCommand\(pinned, searchActive, p\.value\)/)
    const web = readFileSync(new URL("../SearchHeader.web.tsx", import.meta.url), "utf8")
    expect(web).toMatch(/useKeyboardAnchor\(\{ enabled: focused, restOffset: WEB_DOCK_REST_OFFSET \}\)/)
    expect(web).toMatch(/const WEB_DOCK_REST_OFFSET = theme\.space\["3"\] \+ 10/)
  })

  it("targets full merge only in Search, from any entry path", () => {
    expect(searchMorphTarget("search")).toBe(1)
    expect(searchMorphTarget("home")).toBe(0)
    expect(searchMorphTarget("map")).toBe(0)
    expect(searchMorphTarget("messaging")).toBe(0)
  })

  it("remembers the view Search was opened from and passes Search through", () => {
    expect(resolvePreviousView("home", "map")).toBe("map")
    expect(resolvePreviousView("map", "search")).toBe("map")
    expect(resolvePreviousView("map", "messaging")).toBe("messaging")
  })

  it("seeds prevView from the last-non-search view on a deep-link straight into Search (defect 8)", () => {
    expect(seedPreviousView("map", "home")).toBe("map")
    expect(seedPreviousView("search", "map")).toBe("map")
    expect(seedPreviousView("search", "home")).toBe("home")
  })

  it("maps the previous view to its bottom tab, falling back to Home", () => {
    expect(exitTabId("home")).toBe("home")
    expect(exitTabId("map")).toBe("map")
    expect(exitTabId("messaging")).toBe("messages")
    expect(exitTabId("report")).toBe("report")
    expect(exitTabId("events")).toBe("home")
    expect(exitTabId("reports")).toBe("home")
    expect(exitTabId("search")).toBe("home")
  })

  it("disables search rise animation for touch or reduced-motion users", () => {
    expect(searchRiseTransition({ coarsePointer: true, reduceMotion: false })).toBe("none")
    expect(searchRiseTransition({ coarsePointer: false, reduceMotion: true })).toBe("none")
    expect(searchRiseTransition({ coarsePointer: false, reduceMotion: false })).toContain(`${TAB_ANIMATION_MS}ms`)
  })

  it("releases the search body's exit freeze from the dockMorphOut timing, never from a config factory", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(/searchExitPublish\(target, animated\)/)
    expect(native).toMatch(/runOnJS\(setSearchExitSettled\)\(true\)/)
    expect(native).toMatch(/if \(finished\) runOnJS\(setSearchExitSettled\)\(true\)/)
    expect(native).not.toMatch(/\(finished\) => \{[^}]*Config\(\)/)
  })
})

describe("dock-morph chrome schedules (each element rides ONE window off p; no crossfade)", () => {
  it("windowProgress ramps 0->1 across [start,end], clamped", () => {
    expect(windowProgress(0, 0.2, 0.8)).toBe(0)
    expect(windowProgress(0.2, 0.2, 0.8)).toBe(0)
    expect(windowProgress(0.5, 0.2, 0.8)).toBeCloseTo(0.5)
    expect(windowProgress(0.8, 0.2, 0.8)).toBe(1)
    expect(windowProgress(1, 0.2, 0.8)).toBe(1)
  })

  it("non-active tab icons fade out WITH blur over [0,0.40] (nothing pops)", () => {
    expect(tabIconMorph(0)).toEqual({ opacity: 1, blur: 0 })
    expect(tabIconMorph(0.4)).toEqual({ opacity: 0, blur: 8 })
    const mid = tabIconMorph(0.2)
    expect(mid.opacity).toBeCloseTo(0.5)
    expect(mid.blur).toBeCloseTo(4)
    expect(tabIconMorph(0.6)).toEqual({ opacity: 0, blur: 8 })
  })

  it("the active-icon travel finishes WITH the shape over [0.2,0.95] (chrome never leads the material)", () => {
    expect(SCHEDULE.travel).toEqual([0.2, 0.95])
    expect(travelFactor(0.2)).toBe(0)
    expect(travelFactor(0.575)).toBeCloseTo(0.5)
    expect(travelFactor(0.95)).toBe(1)
    expect(travelFactor(0.1)).toBe(0)
    expect(travelFactor(0.8)).toBeCloseTo(0.8)
    expect(travelFactor(1)).toBe(1)
  })

  it("anchors the magnifier to the live field rect (not a p-scheduled travel to the final rect)", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    const magBlock = native.slice(native.indexOf("const magStyle"), native.indexOf("const dockedFieldLeft"))
    expect(magBlock).toMatch(/shapes\.value\.right/)
    expect(magBlock).toMatch(/right\.x/)
    expect(magBlock).toMatch(/right\.y \+ right\.height \/ 2/)
    expect(magBlock).not.toMatch(/travelFactor/)
  })

  it("anchors the persisted-tab glyph travel to the LIVE leading-shape center (not the stale H/2 circle center)", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    const wrapBlock = native.slice(native.indexOf("const wrapStyle"), native.indexOf("const m = tabIconMorph"))
    expect(wrapBlock).toMatch(/shapes\.value\.left/)
    expect(wrapBlock).toMatch(/\.left/)
    expect(wrapBlock).toMatch(/left\.x \+ left\.width \/ 2/)
    expect(wrapBlock).toMatch(/left\.y \+ left\.height \/ 2/)
    expect(native).not.toMatch(/circleCenterX/)
  })

  it("placeholder rides in ONLY in the last shape-morph portion [0.85,1.0] (fades out first on exit)", () => {
    expect(SCHEDULE.placeholder).toEqual([0.85, 1.0])
    expect(placeholderMorph(0.85)).toEqual({ opacity: 0, translateX: 8, blur: 6 })
    expect(placeholderMorph(1.0)).toEqual({ opacity: 1, translateX: 0, blur: 0 })
    expect(placeholderMorph(0.925).opacity).toBeCloseTo(0.5)
    expect(placeholderMorph(0.4).opacity).toBe(0)
    expect(placeholderMorph(0.6).opacity).toBe(0)
    expect(placeholderMorph(0.8).opacity).toBe(0)
  })

  it("the ✕ fades in last [0.70,1.0]", () => {
    expect(SCHEDULE.clear).toEqual([0.7, 1.0])
    expect(clearMorph(0.7)).toEqual({ opacity: 0 })
    expect(clearMorph(1)).toEqual({ opacity: 1 })
    expect(clearMorph(0.85)).toEqual({ opacity: 0.5 })
  })

  it("the ✕ CLEARS back to the resting search page (onClearSearch); only the LEADING circle exits Search", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    const clearBlock = native.slice(native.indexOf("<Animated.View style={[styles.clear"))
    expect(clearBlock).toMatch(/onPress=\{onClearSearch\}/)
    expect(clearBlock).toMatch(/tSearch\("a11y\.clear"\)/)
    expect(clearBlock).not.toMatch(/onExitSearch/)
    expect(clearBlock).not.toMatch(/a11y\.dismiss/)
    const handler = native.slice(native.indexOf("const onClearSearch"), native.indexOf("const minimizedActive"))
    expect(handler).toMatch(/dockedSearch\.onClear\(\)/)
    expect(handler).toMatch(/Keyboard\.dismiss\(\)/)
    expect(handler).not.toMatch(/selectView/)
    const exitHandler = native.slice(native.indexOf("const onExitSearch"), native.indexOf("const onClearSearch"))
    expect(exitHandler).toMatch(/selectView\(prevView\)/)
  })

  it("the schedules are ORDERED so no frame shows both layouts: tabs gone (0.40) well before placeholder (0.65)", () => {
    expect(SCHEDULE.tabIcon[1]).toBeLessThanOrEqual(SCHEDULE.placeholder[0])
    expect(tabIconMorph(SCHEDULE.placeholder[0]).opacity).toBe(0)
  })
})

describe("tab bar height store", () => {
  it("uses a stable nonzero platform fallback before the first layout", () => {
    expect(initialTabBarFootprint("web")).toBeGreaterThan(0)
    expect(initialTabBarFootprint("native")).toBeGreaterThan(0)
  })

  it("includes the native safe area in the initial footprint", () => {
    expect(initialTabBarFootprint("native", 24) - initialTabBarFootprint("native", 0)).toBe(24)
  })

  it("uses the measured footprint once TabBar publishes it", () => {
    const fallback = initialTabBarFootprint("web")
    expect(resolveTabBarFootprint(0, fallback)).toBe(fallback)
    expect(resolveTabBarFootprint(92.6, fallback)).toBe(93)
  })

  it("publishes a rounded non-negative measured footprint", () => {
    useTabBarStore.getState().setTabBarHeight(72.6)
    expect(useTabBarStore.getState().tabBarHeight).toBe(73)
    useTabBarStore.getState().setTabBarHeight(-12)
    expect(useTabBarStore.getState().tabBarHeight).toBe(0)
  })

  it("bottoms the floating dock INSIDE the safe area to match the iOS-26 system tab bar (~21-22pt)", () => {
    expect(dockBottomGap(34)).toBe(22)
    expect(dockBottomGap(0)).toBe(8)
    expect(dockBottomGap(20)).toBe(8)
    expect(dockBottomGap(50)).toBe(38)
  })

  it("keeps the dock's own footprint the ONLY source of every body's bottom inset", () => {
    const plan = readFileSync(new URL("../bodyLayout.ts", import.meta.url), "utf8")
    expect(plan).toMatch(/resolveTabBarFootprint\(/)
    expect(plan).not.toMatch(/\b94\b/)
  })

  it("remembers the last NON-search view across mounts (deep-link seed source), ignoring Search", () => {
    useTabBarStore.getState().noteView("map")
    expect(useTabBarStore.getState().lastNonSearchView).toBe("map")
    useTabBarStore.getState().noteView("search")
    expect(useTabBarStore.getState().lastNonSearchView).toBe("map")
    useTabBarStore.getState().noteView("messaging")
    expect(useTabBarStore.getState().lastNonSearchView).toBe("messaging")
  })
})

describe("dockBottomGap on Android: the system nav bar is reserved IN FULL", () => {
  it("clears the gesture pill and the 3-button bar by the dock's own margin", () => {
    expect(dockBottomGap(24, "android")).toBe(32)
    expect(dockBottomGap(48, "android")).toBe(56)
    expect(dockBottomGap(0, "android")).toBe(DOCK_BOTTOM_MARGIN)
  })

  it("never bottoms the dock inside the nav bar, at any OEM inset", () => {
    for (let inset = 0; inset <= 96; inset++) {
      expect(dockBottomGap(inset, "android")).toBeGreaterThanOrEqual(inset)
    }
  })

  it("raises the gap by a uniform 20dp wherever the iOS floor is not in play", () => {
    for (const inset of [20, 24, 34, 48, 64]) {
      expect(dockBottomGap(inset, "android") - dockBottomGap(inset)).toBe(20)
    }
  })

  it("leaves iOS and web BYTE-IDENTICAL: the default arg reproduces the old formula for every inset", () => {
    for (let inset = 0; inset <= 96; inset++) {
      expect(dockBottomGap(inset)).toBe(Math.max(inset - 12, 8))
      expect(dockBottomGap(inset)).toBe(dockBottomGap(inset, "other"))
    }
    expect(dockBottomGap(-10)).toBe(DOCK_BOTTOM_MARGIN)
    expect(dockBottomGap(-10, "android")).toBe(DOCK_BOTTOM_MARGIN)
  })

  it("gates on Platform.OS in exactly ONE place, and feeds it to BOTH coupled call sites", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    expect(native).toMatch(
      /const DOCK_PLATFORM: DockPlatform = Platform\.OS === "android" \? "android" : "other"/,
    )
    expect(native).toMatch(/paddingBottom: dockBottomGap\(insets\.bottom, DOCK_PLATFORM\)/)
    expect(native).toMatch(/dockKeyboardRestOffset\(insets\.bottom, DOCK_PLATFORM\)/)
    expect(native.match(/Platform\.OS ===/g)).toHaveLength(1)
  })

  it("keeps the platform signal a PARAMETER — tabBarLogic stays react-native-free", () => {
    const logic = readFileSync(new URL("../tabBarLogic.ts", import.meta.url), "utf8")
    expect(logic).not.toMatch(/from "react-native"/)
    expect(logic).toMatch(/export type DockPlatform = "android" \| "other"/)
    expect(logic).toMatch(/platform: DockPlatform = "other"/)
  })

  it("leaves the WEB dock structurally immune — it never consults an inset at all", () => {
    const web = readFileSync(new URL("../TabBar.web.tsx", import.meta.url), "utf8")
    expect(web).toMatch(/paddingBottom: theme\.space\["3"\]/)
    expect(web).not.toMatch(/dockBottomGap|dockKeyboardRestOffset|useSafeAreaInsets|Platform\.OS/)
  })
})

describe("sheetSnapPoints (the compact sheet's three snap heights, shared by both seams)", () => {
  it("returns the design anchors on the reference screen (peek fixed, mid/full scaled)", () => {
    expect(sheetSnapPoints(SHEET_REF_SCREEN, 24)).toEqual([SHEET_REF_PEEK, SHEET_REF_MID, SHEET_REF_FULL])
  })

  it("scales mid/full with the window while peek stays the fixed header anchor", () => {
    const [peek, mid, full] = sheetSnapPoints(1000, 24)
    expect(peek).toBe(SHEET_REF_PEEK)
    expect(mid).toBe(Math.round((SHEET_REF_MID * 1000) / SHEET_REF_SCREEN))
    expect(full).toBe(Math.round((SHEET_REF_FULL * 1000) / SHEET_REF_SCREEN))
  })

  it("caps the tall snaps at windowHeight - topReserve, so the reserve always stays clear", () => {
    const topReserve = 100
    const [, , full] = sheetSnapPoints(700, topReserve)
    expect(full).toBe(700 - topReserve)
  })

  it("stays STRICTLY increasing on a degenerate (tiny) window - both seams index it as three stops", () => {
    const [peek, mid, full] = sheetSnapPoints(120, 100)
    expect(mid).toBeGreaterThan(peek)
    expect(full).toBeGreaterThan(mid)
  })
})

describe("docked search bar pinned-state store", () => {
  beforeEach(() => useSearchBarStore.setState({ pinned: false, barHeight: 60 }))

  it("defaults to unpinned so web (which never sets it) keeps its resting layout", () => {
    expect(useSearchBarStore.getState().pinned).toBe(false)
  })

  it("publishes the pinned state for SearchBody to clear its title", () => {
    useSearchBarStore.getState().setPinned(true)
    expect(useSearchBarStore.getState().pinned).toBe(true)
    useSearchBarStore.getState().setPinned(false)
    expect(useSearchBarStore.getState().pinned).toBe(false)
  })

  it("publishes a rounded non-negative measured bar height", () => {
    useSearchBarStore.getState().setBarHeight(61.4)
    expect(useSearchBarStore.getState().barHeight).toBe(61)
    useSearchBarStore.getState().setBarHeight(-5)
    expect(useSearchBarStore.getState().barHeight).toBe(0)
  })
})

describe("dockOcclusionFromSheet (fluid sheet<->dock handoff)", () => {
  it("keeps the dock fully shown while the sheet is gone / all but off-screen", () => {
    expect(dockOcclusionFromSheet(0)).toBe(0)
    expect(dockOcclusionFromSheet(DOCK_SHEET_CLEAR)).toBe(0)
    expect(dockOcclusionFromSheet(-20)).toBe(0)
  })

  it("fully hides the dock once the sheet stands over the dock zone (any resting snap)", () => {
    expect(dockOcclusionFromSheet(DOCK_SHEET_COVERED)).toBe(1)
    expect(dockOcclusionFromSheet(470)).toBe(1)
    expect(dockOcclusionFromSheet(786)).toBe(1)
  })

  it("crossfades monotonically across the band, so the dock RIDES the sliding card (no pop)", () => {
    const mid = (DOCK_SHEET_CLEAR + DOCK_SHEET_COVERED) / 2
    expect(dockOcclusionFromSheet(mid)).toBeCloseTo(0.5)
    let prev = -1
    for (let v = -50; v <= 900; v += 25) {
      const occ = dockOcclusionFromSheet(v)
      expect(occ).toBeGreaterThanOrEqual(prev)
      expect(occ).toBeGreaterThanOrEqual(0)
      expect(occ).toBeLessThanOrEqual(1)
      prev = occ
    }
  })

  it("worklet literals match the exported band constants (module-const capture caveat)", () => {
    expect(dockOcclusionFromSheet(DOCK_SHEET_CLEAR + 0.001)).toBeGreaterThan(0)
    expect(dockOcclusionFromSheet(DOCK_SHEET_COVERED - 0.001)).toBeLessThan(1)
    expect(dockOcclusionFromSheet(DOCK_SHEET_CLEAR - 0.001)).toBe(0)
    expect(dockOcclusionFromSheet(DOCK_SHEET_COVERED + 0.001)).toBe(1)
  })

  it("the band starts well above the dock's own footprint so the fade has real travel to breathe", () => {
    expect(DOCK_SHEET_COVERED).toBeGreaterThan(initialTabBarFootprint("native", 34) + 100)
    expect(DOCK_SHEET_CLEAR).toBeGreaterThan(0)
    expect(DOCK_OCCLUSION_SINK).toBeGreaterThan(0)
  })
})

describe("selectedPillRect (news-01 selected-tab lozenge geometry)", () => {
  const tabW = 71.5

  it("is centered in the dock band with the uniform system inset, wrapping the band-centered glyph", () => {
    const glyphTop = TAB_ICON_CENTER_Y - TAB_ICON_SIZE / 2
    const glyphBottom = TAB_ICON_CENTER_Y + TAB_ICON_SIZE / 2
    const r = selectedPillRect(0, tabW)
    expect(r.y).toBe(TAB_PILL_INSET_Y)
    expect(r.height).toBe(DOCK_H - TAB_PILL_INSET_Y * 2)
    expect(DOCK_H - (r.y + r.height)).toBe(r.y)
    expect(TAB_ICON_CENTER_Y).toBe(DOCK_H / 2)
    expect(r.y + r.height / 2).toBe(TAB_ICON_CENTER_Y)
    expect(r.y).toBeLessThanOrEqual(glyphTop)
    expect(r.y + r.height).toBeGreaterThanOrEqual(glyphBottom)
  })

  it("fills the cell horizontally minus the system edge gap, so the pill is never flush with the dock border", () => {
    const r = selectedPillRect(0, tabW)
    expect(r.width).toBeCloseTo(tabW - TAB_PILL_INSET_X * 2)
    expect(r.x).toBeGreaterThanOrEqual(4)
    expect(r.width).toBeGreaterThan(tabW - 12)
  })

  it("the SWITCHED lozenge is pixel-identical to the mount one: only x differs, by exactly one cell", () => {
    const mount = selectedPillRect(0, tabW)
    for (const index of [1, 2, 3]) {
      const switched = selectedPillRect(index, tabW)
      expect(switched.width).toBe(mount.width)
      expect(switched.height).toBe(mount.height)
      expect(switched.y).toBe(mount.y)
      expect(switched.x).toBeCloseTo(index * tabW + TAB_PILL_INSET_X)
      expect(switched.x - mount.x).toBeCloseTo(index * tabW)
    }
  })

  it("clamps width to >= 0 for a degenerate (pre-measurement) zero cell width", () => {
    const r = selectedPillRect(0, 0)
    expect(r.width).toBe(0)
    expect(r.height).toBeGreaterThan(0)
  })
})

describe("drag-to-select lozenge (iOS-26 system tab bar): pillDragRect + lockedIndexForPillCenter", () => {
  const tabW = 71.5
  const count = 4

  it("matches selectedPillRect geometry exactly except x: the dragged lozenge IS the selected lozenge", () => {
    const selected = selectedPillRect(0, tabW)
    const dragged = pillDragRect(tabW * 1.7, tabW, count)
    expect(dragged.width).toBe(selected.width)
    expect(dragged.height).toBe(selected.height)
    expect(dragged.y).toBe(selected.y)
  })

  it("centers the lozenge under the finger across the interior of the strip", () => {
    for (const fingerX of [tabW / 2, tabW, tabW * 1.5, tabW * 2.25, tabW * 3.5]) {
      const r = pillDragRect(fingerX, tabW, count)
      expect(r.x + r.width / 2).toBeCloseTo(fingerX)
    }
  })

  it("at a cell center, the dragged rect is pixel-identical to that cell's selectedPillRect", () => {
    for (const index of [0, 1, 2, 3]) {
      const dragged = pillDragRect(index * tabW + tabW / 2, tabW, count)
      expect(dragged).toEqual(selectedPillRect(index, tabW))
    }
  })

  it("clamps + rubber-bands beyond the outermost cell centers, capped so the cap never exits the strip", () => {
    const firstCenter = tabW / 2
    const lastCenter = (count - 0.5) * tabW
    const slight = pillDragRect(firstCenter - 10, tabW, count)
    expect(slight.x + slight.width / 2).toBeCloseTo(firstCenter - 10 * PILL_DRAG_RESISTANCE)
    const leftMax = pillDragRect(-500, tabW, count)
    expect(leftMax.x).toBeCloseTo(0)
    const rightMax = pillDragRect(count * tabW + 500, tabW, count)
    expect(rightMax.x + rightMax.width).toBeCloseTo(count * tabW)
    expect(lastCenter).toBeLessThan(count * tabW)
  })

  it("locks onto the cell containing the lozenge center (nearest cell center) on release", () => {
    for (const index of [0, 1, 2, 3]) {
      expect(lockedIndexForPillCenter(index * tabW + tabW / 2, tabW, count)).toBe(index)
    }
    expect(lockedIndexForPillCenter(tabW - 0.01, tabW, count)).toBe(0)
    expect(lockedIndexForPillCenter(tabW + 0.01, tabW, count)).toBe(1)
    expect(lockedIndexForPillCenter(3 * tabW - 0.01, tabW, count)).toBe(2)
  })

  it("clamps the locked index to [0, count-1] for rubber-banded overshoot, and degenerate tabW locks 0", () => {
    expect(lockedIndexForPillCenter(-50, tabW, count)).toBe(0)
    expect(lockedIndexForPillCenter(count * tabW + 50, tabW, count)).toBe(count - 1)
    expect(lockedIndexForPillCenter(100, 0, count)).toBe(0)
    expect(lockedIndexForPillCenter(100, -5, count)).toBe(0)
  })

  it("a released drag position round-trips: pillDragRect center -> lockedIndex -> that cell's rect", () => {
    for (const fingerX of [-30, 12, 60, 110, 200, 250, 310]) {
      const r = pillDragRect(fingerX, tabW, count)
      const index = lockedIndexForPillCenter(r.x + r.width / 2, tabW, count)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThanOrEqual(count - 1)
      const locked = selectedPillRect(index, tabW)
      expect(Math.abs(locked.x - r.x)).toBeLessThanOrEqual(tabW / 2 + TAB_PILL_INSET_X)
    }
  })
})

describe("dock + sheet animation cost", () => {
  it("evaluates the dock morph geometry exactly once per frame", () => {
    const native = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")
    const dock = readFileSync(
      new URL("../../surface/liquidGlass/LiquidGlassDock.native.tsx", import.meta.url),
      "utf8",
    )
    const callSite = /(?:=>|=|:)\s*dockShapes\(/g
    expect((native.match(callSite) ?? []).length).toBe(1)
    expect((dock.match(callSite) ?? []).length).toBe(1)
  })

  it("passes an explicit animationConfigs to the gorhom sheet", () => {
    const shell = readFileSync(new URL("../CompactShell.native.tsx", import.meta.url), "utf8")
    expect(shell).toMatch(/animationConfigs=\{animationConfigs\}/)
    expect(shell).toMatch(/closing \? sheetDismissConfig\(\) : sheetMoveConfig\(\)/)
    expect(shell).toMatch(/enableContentPanningGesture=\{false\}/)
  })

  it("composes the sheet scroll host innermost-first: handoff -> keyboard-aware -> minimize", () => {
    const shell = readFileSync(new URL("../CompactShell.native.tsx", import.meta.url), "utf8")
    expect(shell).toMatch(/import \{ makeSheetHandoffScrollHost \} from "\.\/SheetHandoffScroll\.native"/)
    const composition =
      /makeMinimizeAwareScrollHost\(\s*makeKeyboardAwareScrollHost\(\s*makeSheetHandoffScrollHost\(/
    expect(shell).toMatch(composition)
  })

  it("scopes the keyboard-aware heuristics away from hosts that own no input", () => {
    const reveal = readFileSync(new URL("../SearchBodyReveal.native.tsx", import.meta.url), "utf8")
    expect(reveal).toMatch(/ownsFocusedInput:\s*false/)
    expect(reveal).toMatch(/reserveKeyboardPadding:\s*false/)
    expect(reveal).toMatch(/makeDockClearanceScrollHost\(\s*makeKeyboardAwareScrollHost\(/)
    const portrait = readFileSync(new URL("../PortraitShell.shared.tsx", import.meta.url), "utf8")
    expect(portrait).not.toMatch(/PORTRAIT_SCROLL_HOST_SEARCH/)
    expect(portrait).toMatch(/const baseScrollHost = PORTRAIT_BASE_SCROLL_HOST\b/)
    expect(portrait).toMatch(/ownsFocusedInput: \(\) => !baseSurfaceUnderSearchOverlay\(\)/)
    expect(portrait).toMatch(/reserveKeyboardPadding: \(\) => !baseSurfaceUnderSearchOverlay\(\)/)
    expect(portrait).toMatch(/Platform\.OS !== "web" && useNavStore\.getState\(\)\.view === "search"/)
    const kbNative = readFileSync(new URL("../KeyboardAwareScroll.native.tsx", import.meta.url), "utf8")
    expect(kbNative).toMatch(/\|\| !ownsFocusedInput\(\)\) return/)
    expect(kbNative).toMatch(/reserves: pageActiveRef\.current && reserveKeyboardPadding\(\),/)
    const thread = readFileSync(new URL("../../bodies/PostThreadBody.tsx", import.meta.url), "utf8")
    expect(thread).not.toMatch(/^import[^\n]*useKeyboardInset/m)
    expect(thread).not.toMatch(/useKeyboardInset\s*\(/)
  })

  it("clears the FLOATING dock with scroll-content padding, never with layer padding", () => {
    const reveal = readFileSync(new URL("../SearchBodyReveal.native.tsx", import.meta.url), "utf8")
    expect(reveal).toMatch(/style=\{\[styles\.layer, \{ paddingTop: topInset \}, revealStyle\]\}/)
    expect(reveal).not.toMatch(/paddingBottom: bottomInset/)
    expect(reveal).toMatch(/paddingBottom: basePad \+ clearance/)
    expect(reveal).toMatch(/resolveTabBarFootprint\(footprint, fallback\) \+ keyboardReserve/)
    expect(reveal).toMatch(/scrollIndicatorInsets \?\? \{ bottom: clearance \}/)
    expect(reveal).toMatch(/^const PORTRAIT_SCROLL_HOST = makeDockClearanceScrollHost\(/m)
    expect(reveal).toMatch(/backgroundColor: t\.colors\.bg/)
    const portrait = readFileSync(new URL("../PortraitShell.shared.tsx", import.meta.url), "utf8")
    expect(portrait).toMatch(/opaqueSurface: \{\s*backgroundColor: t\.colors\.bg,?\s*\}/)
  })
})

describe("tab-strip drag: gesture callbacks stay UI-thread safe", () => {
  const src = readFileSync(new URL("../TabBar.native.tsx", import.meta.url), "utf8")

  const panChain = () => {
    const start = src.indexOf("const pan = useMemo(")
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf("\n\n", start)
    expect(end).toBeGreaterThan(start)
    const chain = src.slice(start, end).replace(/\/\/[^\n]*/g, "")
    expect(chain).toMatch(/Gesture\.Pan\(\)/)
    expect(chain).toMatch(/\.onFinalize\(/)
    expect(chain).toMatch(/runOnJS\(lockOnTab\)\(index\)/)
    return chain
  }

  it("never invokes a motion-config factory inside the pan chain", () => {
    expect(panChain()).not.toMatch(/Config\s*\(/)
  })

  it("hoists the pill curve to the JS thread and captures the object in the worklet", () => {
    expect(src).toMatch(/const pillCfg = useMemo\(\(\) => tabPillConfig\(\), \[\]\)/)
    expect(panChain()).toMatch(/withTiming\(lockedX, pillCfg\)/)
  })

  it("records THE RULE where the next person will read it", () => {
    const configs = readFileSync(new URL("../motionConfigs.native.ts", import.meta.url), "utf8")
    expect(configs).toMatch(/JS-THREAD ONLY/)
  })
})

describe("the keyboard-aware scroll seam measures the keyboard instead of trusting the window", () => {
  const seam = () => readFileSync(new URL("../KeyboardAwareScroll.native.tsx", import.meta.url), "utf8")

  it("never reads endCoordinates.screenY — on Android it is the window bottom, not the keyboard top", () => {
    expect(seam()).not.toMatch(/screenY/)
  })

  it("reserves on EVERY platform, through the pure model", () => {
    const text = seam()
    expect(text).toMatch(/\n  keyboardViewportOverlap,\n[\s\S]*?\} from "\.\/keyboardInsetModel"/)
    expect(text).not.toMatch(/Platform\.OS === "ios"\s*\n?\s*\? \(e\.endCoordinates/)
    expect(text).toMatch(/reserves: pageActiveRef\.current && reserveKeyboardPadding\(\),/)
  })

  it("derives the keyboard top from the measured overlap", () => {
    expect(seam()).toMatch(
      /const keyboardTop = keyboardTopInWindow\(Dimensions\.get\("window"\)\.height, state\.overlap\)/,
    )
  })
})

describe("ONE overlap model: every keyboard measurement in the package goes through keyboardViewportOverlap", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it.each([
    ["../KeyboardAwareScroll.native.tsx"],
    ["../useKeyboardAnchor.native.ts"],
    ["../../bodies/thread/useReplyDockInset.ts"],
  ])("%s measures through the model and re-derives nothing of its own", (rel) => {
    const text = read(rel)
    expect(text).toMatch(/keyboardViewportOverlap\(\{/)
    expect(text).not.toMatch(/endCoordinates\.height\s*[-+]/)
    expect(text).not.toMatch(/androidKeyboardInset\(/)
  })

  it("gives the anchor's JS branch the SAME resting-window correction the seam has", () => {
    const anchor = read("../useKeyboardAnchor.native.ts")
    expect(anchor).not.toMatch(/keyboardOverlapFrom/)
    expect(anchor).toMatch(/restingWindowHeight: restingWindowHeight\.current/)
    expect(anchor).toMatch(/systemBarInset: systemBarRef\.current/)
  })

  it("routes the anchor's UI-thread mirror through keyboardMirrorOverlap, never through its own arithmetic", () => {
    const anchor = read("../useKeyboardAnchor.native.ts")
    expect(anchor).toMatch(/const systemBarInset = PLATFORM === "android" \? safeAreaBottom : 0/)
    expect(anchor).toMatch(/import \{ isEdgeToEdge \} from "react-native-is-edge-to-edge"/)
    expect(anchor).toMatch(/^const EDGE_TO_EDGE = isEdgeToEdge\(\)$/m)
    expect(anchor).toMatch(
      /overlap\.value = keyboardMirrorOverlap\(\{\s*\n\s*reanimatedHeight: h,\s*\n\s*systemBarInset: systemBarSv\.value,\s*\n\s*edgeToEdge: EDGE_TO_EDGE,\s*\n\s*\}\)/,
    )
    expect(anchor).not.toMatch(/h \+ systemBarSv\.value/)
  })

  it("captures the resting window height ONCE, in a shared helper both seams call", () => {
    const helper = read("../useRestingWindowHeight.ts")
    expect(helper).toMatch(/Dimensions\.addEventListener\("change"/)
    expect(helper).toMatch(/Keyboard\.isVisible\(\)/)
    expect(helper).toMatch(/import \{ shouldRecaptureRestingHeight \} from "\.\/keyboardInsetModel"/)
    expect(helper).toMatch(/prevWidth: restingWindowWidth\.current/)
    expect(helper).toMatch(/nextWidth: window\.width/)
    for (const rel of [
      "../KeyboardAwareScroll.native.tsx",
      "../useKeyboardAnchor.native.ts",
      "../../bodies/thread/useReplyDockInset.ts",
    ]) {
      expect(read(rel)).toMatch(/useRestingWindowHeight\(\)/)
      expect(read(rel)).not.toMatch(/restingWindowHeight\.current = /)
    }
  })
})

describe("useKeyboardReserve is a seam pair, and iOS pays nothing for it", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("picks the iOS no-op at MODULE scope, so no hook is called conditionally", () => {
    const native = read("../useKeyboardReserve.native.ts")
    expect(native).toMatch(
      /export const useKeyboardReserve: \(options\?: KeyboardReserveOptions\) => number =\s*\n\s*Platform\.OS === "ios" \? useZeroReserve : useWindowOverlapReserve/,
    )
    expect(native).toMatch(/function useZeroReserve\([^)]*\): number \{\s*\n\s*return 0\s*\n\s*\}/)
    expect(native).not.toMatch(/useKeyboardAnchor\(\{[^}]*\}\)[\s\S]*insets/)
  })

  it("reserves the anchor's overlap with the gap zeroed, on BOTH seams", () => {
    expect(read("../useKeyboardReserve.native.ts")).toMatch(
      /useKeyboardAnchor\(\{ enabled, restOffset, gap: 0 \}\)\.reserved/,
    )
    expect(read("../useKeyboardReserve.web.ts")).toMatch(
      /useKeyboardAnchor\(\{ enabled, restOffset, gap: 0, hostReserved \}\)\.reserved/,
    )
  })

  it("adds NOTHING of its own on top of the anchor — the safe-area pad is an explicit restOffset", () => {
    const native = read("../useKeyboardReserve.native.ts")
    expect(native).not.toMatch(/SafeAreaInsetsContext/)
    expect(native).not.toMatch(/reserved \+ /)
    expect(read("../useKeyboardReserve.types.ts")).toMatch(/restOffset\?: number/)
    expect(read("../useKeyboardReserve.types.ts")).toMatch(/hostReserved\?: boolean/)
  })

  it("resolves the extension-less selector to the WEB seam, like every other seam here", () => {
    expect(read("../useKeyboardReserve.ts")).toMatch(
      /export \{ useKeyboardReserve \} from "\.\/useKeyboardReserve\.web"/,
    )
  })
})

describe("the pinned wizard footers reserve for the Android keyboard nothing else reserves for them", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it.each([
    ["../../bodies/NewGroupBody.tsx", 2],
    ["../../bodies/NewChannelBody.tsx", 3],
  ])("%s lifts every pinned footer", (rel, footers) => {
    const text = read(rel)
    expect(text).toMatch(/import \{ useKeyboardReserve \} from "\.\.\/shell\/useKeyboardReserve"/)
    expect(text).toMatch(/const kbReserve = useKeyboardReserve\(\)/)
    expect(
      text.match(/<View style=\{\[styles\.footer, kbReserve > 0 \? \{ marginBottom: kbReserve \} : null\]\}>/g),
    ).toHaveLength(footers)
    expect(text).not.toMatch(/<View style=\{styles\.footer\}>/)
  })

  it("still declares itself keyboardAvoidance:false, so the reserve is the ONLY owner", () => {
    const layout = read("../bodyLayout.ts")
    expect(layout).toMatch(/"new-group": "full"/)
    expect(layout).toMatch(/"new-channel": "full"/)
    expect(layout).toMatch(/surfaceKeyboardAvoidance: active\?\.kind === "composer"/)
  })
})

describe("ONE Android owner per surface: the reserve, never a live KeyboardAvoidingView beside it", () => {
  const PRUNED = new Set(["node_modules", "__tests__", "ios", "android", ".expo", "dist", "dist-types", "out", ".next"])
  const ROOTS = [
    fileURLToPath(new URL("../../", import.meta.url)),
    fileURLToPath(new URL("../../../../../apps/community-mobile/", import.meta.url)),
  ]
  const NEUTRAL_BEHAVIOR = '{Platform.OS === "ios" ? "padding" : undefined}'

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (PRUNED.has(entry.name)) return []
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : []
    })

  const consumers = () =>
    ROOTS.flatMap(walk).filter((file) => /const \w+ = useKeyboardReserve\(/.test(readFileSync(file, "utf8")))

  it("sees every surface that reads the reserve", () => {
    expect(consumers().map((file) => basename(file)).sort()).toEqual([
      "ConversationBody.tsx",
      "DeleteAccountModal.tsx",
      "FirstRunGate.tsx",
      "ModalCardSheet.tsx",
      "NewChannelBody.tsx",
      "NewGroupBody.tsx",
      "ReportFlowBody.tsx",
    ])
  })

  it("gives none of them a KeyboardAvoidingView that is live on Android", () => {
    for (const file of consumers()) {
      for (const [, behavior] of readFileSync(file, "utf8").matchAll(/behavior=(\{[^}]*\}|"[^"]*")/g)) {
        expect([basename(file), behavior]).toEqual([basename(file), NEUTRAL_BEHAVIOR])
      }
    }
  })
})

describe("hostReserved is a WEB-only option the native seam never forwards", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("says so in the TYPE NAME: only the web-only option type carries hostReserved", () => {
    const types = read("../useKeyboardReserve.types.ts")
    expect(types).toMatch(
      /export interface WebOnlyKeyboardReserveOptions extends KeyboardReserveOptions \{\s*\n\s*hostReserved\?: boolean\s*\n\s*\}/,
    )
    expect(types).not.toMatch(/interface KeyboardReserveOptions \{[^}]*hostReserved/)
    expect(read("../useKeyboardReserve.web.ts")).toMatch(/\}: WebOnlyKeyboardReserveOptions = \{\}\): number/)
  })

  it("never reaches the native anchor, which has no ancestor to double-count", () => {
    const native = read("../useKeyboardReserve.native.ts")
    expect(native).not.toMatch(/hostReserved/)
    expect(native).not.toMatch(/WebOnlyKeyboardReserveOptions = \{\}/)
  })
})

describe("tab divider is a soft rule, not an icon-weight bar", () => {
  const dividerBlocks = ["TabBar.shared.tsx", "TabBar.native.tsx", "Rail.tsx"].map((file) => {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    const start = src.indexOf("  divider: {")
    if (start < 0) throw new Error(`no divider style block in ${file}`)
    const end = src.indexOf("\n  },", start)
    if (end < 0) throw new Error(`unterminated divider style block in ${file}`)
    return { file, block: src.slice(start, end) }
  })

  it("paints the rule with the hairline-rule token on every seam that draws it", () => {
    for (const { file, block } of dividerBlocks) {
      expect(block, file).toMatch(/backgroundColor: t\.colors\.borderStrong/)
    }
  })

  it("never reuses the icon token, so the rule stays subtler than the glyphs it separates", () => {
    for (const { file, block } of dividerBlocks) {
      expect(block, file).not.toMatch(/t\.colors\.textMuted/)
    }
  })

  it("spans 60% of the bar height, rounded, centered, and sits on the report seam", () => {
    expect(tabDividerRect(80, 64)).toEqual({ left: 239.25, top: 13, height: 38 })
    expect(tabDividerRect(80, 60)).toEqual({ left: 239.25, top: 12, height: 36 })
  })
})
