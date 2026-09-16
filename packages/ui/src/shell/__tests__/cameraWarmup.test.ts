import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { portraitShellPlan } from "../bodyLayout"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const appShell = read("../AppShell.tsx")
const portrait = read("../PortraitShell.shared.tsx")
const bodyTransition = read("../BodyTransition.native.tsx")
const mapNative = read("../../map/Map.native.tsx")
const reportBody = read("../../bodies/ReportFlowBody.tsx")

const VIEWS = ["home", "map", "messaging", "report", "search", "social"] as const

describe("1. the retained map goes INERT while it is not the surface", () => {
  it("hides it with opacity, never display:none (Fabric culls display:none native views, rebuilding the map per switch)", () => {
    expect(appShell).toMatch(/mapDetached: \{ opacity: 0, pointerEvents: "none" \}/)
    expect(appShell).not.toMatch(/display: "none"/)
    expect(appShell).toContain("mapVisible ? null : styles.mapDetached")
    expect(appShell).toContain("accessibilityElementsHidden={!mapVisible}")
  })

  it("derives visibility from the OPAQUE-COVER invariant, not from a second view list", () => {
    expect(appShell).toContain('const mapVisible = mode === "expanded" || !basePlan.renderBaseBody')
  })

  it("only ever detaches the map on a view that paints an opaque base body over it", () => {
    for (const view of VIEWS) {
      const plan = portraitShellPlan(view, null, false, true)
      const detached = plan.renderBaseBody
      const showsMapItself = portraitShellPlan(view, null, false, false).mountMap
      expect(detached, view).toBe(!showsMapItself)
    }
  })

  it("keeps the map ATTACHED under the search overlay, which is painted over nothing", () => {
    expect(portraitShellPlan("map", null, false, true).renderBaseBody).toBe(false)
  })
})

describe("2. the retained map is not RE-RENDERED from a tab it is invisible on", () => {
  it("memoizes the native seam", () => {
    expect(mapNative).toContain("export const Map = memo(forwardRef<MapHandle, MapProps>(function Map(props, ref) {")
    expect(mapNative).toMatch(/import React, \{ forwardRef, memo,/)
  })
})

describe("3. the report slot is PRE-WARMED after boot, and OFF the boot path", () => {
  it("mounts the slot on a real clock, well past the splash", () => {
    expect(portrait).toContain("const handle = setTimeout(() => setMounted(true), prewarmDelayMs)")
    expect(portrait).toMatch(
      /const reportSlotMounted = useKeepAliveSlotMounted\(\s*reportSlotVisible,\s*RETAIN_REPORT_BODY,\s*REPORT_PREWARM_DELAY_MS,\s*\)/,
    )
    expect(portrait).toContain("const REPORT_PREWARM_DELAY_MS = 3000")
  })

  it("does NOT gate on runAfterInteractions, which is a bare setImmediate under RN 0.81", () => {
    expect(portrait).not.toMatch(/InteractionManager\.runAfterInteractions/)
    expect(portrait).toContain('import { Platform, StyleSheet, View } from "react-native"')
  })

  it("is NATIVE-ONLY and cancels a pending pre-warm", () => {
    expect(portrait).toMatch(/if \(!retained \|\| mounted\) return/)
    expect(portrait).toContain("return () => clearTimeout(handle)")
  })

  it("does NOT pre-arm the session - the slot is warmed, the camera is not started", () => {
    expect(portrait).toContain('const reportSlotVisible = RETAIN_REPORT_BODY && frame.base.bodyMounted && baseView === "report"')
    expect(reportBody).toContain(
      "viewfinderSessionActive(activeStep, viewfinderMounted, stackNonEmpty, runActive)",
    )
  })
})

describe("4. the body swap declares itself a non-interaction", () => {
  it("declares BOTH entrance channels non-interactions", () => {
    expect(bodyTransition.match(/isInteraction: false,/g) ?? []).toHaveLength(2)
    expect(bodyTransition).toMatch(/useNativeDriver: true,\n\s*isInteraction: false,/)
  })

  it("defers the camera mount on a real clock, past the page-push transition", () => {
    expect(reportBody).toContain(
      "const handle = setTimeout(() => setViewfinderMountable(true), VIEWFINDER_MOUNT_DELAY_MS)",
    )
    expect(reportBody).toContain("const VIEWFINDER_MOUNT_DELAY_MS = motion.pagePush.duration")
  })

  it("does NOT gate the camera mount on runAfterInteractions either", () => {
    expect(reportBody).not.toMatch(/InteractionManager/)
  })
})

describe("5. the resume grace is offered to the host, and only the host can honour it", () => {
  it("passes the shared eligibility as its own prop, beside `active` and never instead of it", () => {
    expect(reportBody).toMatch(/resumeGrace=\{sessionResumeGrace\}/)
    expect(reportBody).toMatch(
      /const sessionResumeGrace = viewfinderResumeGraceEligible\(\s*activeStep,\s*viewfinderMounted,\s*stackNonEmpty,\s*runActive,\s*\)/,
    )
  })
})
