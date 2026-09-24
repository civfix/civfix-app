/**
 * The web maps are built once per mount and torn down by their effect cleanup, so their construction
 * effects must not list a value that changes while the map lives. Inputs read at construction come from
 * latest-value refs written after commit; the dependencies that are listed must be stable identities.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  expectWrittenInLayoutEffect,
  layoutEffectBodies,
  sliceBetween,
  sliceFrom,
} from "../../__tests__/sourceGuards"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

/**
 * A discarded concurrent render must not leave a latest-value ref holding props that never committed,
 * so every write to one of these refs sits inside a layout effect of the component.
 */
function expectNoRenderPhaseRefWrites(component: string, refs: readonly string[]): void {
  const effects = layoutEffectBodies(component)
    .map((effect) => effect.body)
    .join("\n")
  for (const ref of refs) {
    const write = new RegExp(`(?<![\\w$.])${ref}\\.current\\s*=(?!=)`, "g")
    const total = component.match(write)?.length ?? 0
    const inEffects = effects.match(write)?.length ?? 0
    expect(total, `${ref} is never written`).toBeGreaterThan(0)
    expect(total - inEffects, `${ref}.current is written during render`).toBe(0)
  }
}

function expectLatestValueRefs(component: string, refs: Record<string, string>): void {
  for (const [ref, value] of Object.entries(refs)) expectWrittenInLayoutEffect(component, `${ref}.current = ${value}`)
  expectNoRenderPhaseRefWrites(component, Object.keys(refs))
}

describe("LocationPicker.web", () => {
  const src = read("../LocationPicker.web.tsx")
  const inline = sliceBetween(src, "function InlineLocationPicker(", "function samePickPoint(")
  const mainMap = sliceBetween(src, "function MainMapLocationPicker(", "export function LocationPicker(")

  it("builds the inline map once per seed, placing the first marker from the committed value", () => {
    expect(sliceBetween(inline, "const ensureMarker = React.useCallback(", "React.useEffect(")).toContain(
      "    [],\n  )",
    )
    const build = sliceBetween(inline, "if (mapRef.current || !containerRef.current || !cameraSeed) return", "React.useEffect(")
    expect(build).toContain("if (valueRef.current) ensureMarker(map, start)")
    expect(build).toContain("}, [cameraSeed, ensureMarker])")
    expectWrittenInLayoutEffect(inline, "valueRef.current = value")
  })

  it("starts the main-map pick session once, from the committed value", () => {
    const start = sliceBetween(mainMap, "useLocationPick.getState().start(valueRef", "React.useEffect(")
    expect(start).toContain("}, [])")
    expectWrittenInLayoutEffect(mainMap, "valueRef.current = value")
  })
})

describe("Map.web", () => {
  const src = read("../Map.web.tsx")

  it("keeps the idle runner for the life of the component, so listing it never rebuilds the map", () => {
    expect(src).toContain("if (runnerRef.current === null) runnerRef.current = createIdleRunner(")
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useEffect(")
    expect(build).toContain("}, [runner])")
  })

  it("reads the initial basemap from the last committed render", () => {
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useEffect(")
    expect(build).toContain("cartoApiKey: cartoApiKeyRef.current,")
    expectWrittenInLayoutEffect(src, "cartoApiKeyRef.current = cartoApiKey")
  })
})

describe("ReportPickMap.web", () => {
  const src = read("../ReportPickMap.web.tsx")

  it("builds its map once and reads the CARTO key from the last committed render", () => {
    expect(src).toContain("if (runnerRef.current === null) runnerRef.current = createIdleRunner(")
    const build = sliceBetween(src, "if (mapRef.current || !containerRef.current) return", "React.useMemo(")
    expect(build).toContain("cartoApiKey: cartoApiKeyRef.current,")
    expect(build).toContain("}, [runner])")
    expectWrittenInLayoutEffect(src, "cartoApiKeyRef.current = cartoApiKey")
  })
})

describe("PortraitMapPickStep", () => {
  it("web seeds its point on the open edge only, from the committed value", () => {
    const src = read("../PortraitMapPickStep.web.tsx")
    const seed = sliceBetween(src, "if (!live) return\n", "}, [live])")
    expect(seed).toContain("pointRef.current = valueRef.current ?? null")
    expect(seed).not.toMatch(/\bvalue \?\?/)
    expectWrittenInLayoutEffect(src, "valueRef.current = value")
  })

  it("web seeds the shown point during the opening render, so a reopen never paints the last session's point", () => {
    const src = read("../PortraitMapPickStep.web.tsx")
    expect(src).toContain("useResetOnOpen(live, () => setLocalPoint(value ?? null))")
    expect(sliceBetween(src, "if (!live) return\n", "}, [live])")).not.toContain("setLocalPoint(")
  })

  it("native drop and address handlers list the stable point setter", () => {
    const src = read("../PortraitMapPickStep.native.tsx")
    expect(sliceBetween(src, "const setLocalPoint = useCallback(", "const onConfirmRef")).toContain("    [],\n  )")
    expect(sliceBetween(src, "const onPickPlace = useCallback(", "const onMapDrop")).toContain("[setLocalPoint],")
    expect(src).toContain("setLocalPoint({ lat, lng }), [setLocalPoint])")
  })
})

describe("latest-value refs are written after commit, never during render", () => {
  it("LayersPopover", () => {
    const component = sliceFrom(read("../LayersPopover.tsx"), "export function LayersPopover(")
    expectLatestValueRefs(component, { onClosedRef: "onClosed" })
  })

  it("LocationPicker.web inline picker", () => {
    const src = read("../LocationPicker.web.tsx")
    const inline = sliceBetween(src, "function InlineLocationPicker(", "function samePickPoint(")
    expectLatestValueRefs(inline, {
      themeRef: "th",
      pinFillRef: "pinFill",
      cartoApiKeyRef: "cartoApiKey",
      onChangeRef: "onChange",
    })
  })

  it("LocationPicker.web main-map picker", () => {
    const src = read("../LocationPicker.web.tsx")
    const mainMap = sliceBetween(src, "function MainMapLocationPicker(", "export function LocationPicker(")
    expectLatestValueRefs(mainMap, { onChangeRef: "onChange", onClearRef: "onClear", pinRef: "pin" })
  })

  it("Map.web", () => {
    const component = sliceFrom(read("../Map.web.tsx"), "export const Map = React.forwardRef")
    expectLatestValueRefs(component, {
      themeRef: "th",
      pickActiveRef: "pickActive",
      onRegionChangeRef: "onRegionChange",
      onUserCameraMoveRef: "onUserCameraMove",
      onPressMapRef: "onPressMap",
      onPressPinRef: "onPressPin",
      onPressCleanupRef: "onPressCleanup",
      userLocationRef: "userLocation",
      onPressClusterRef: "onPressCluster",
      onPressBlendRef: "onPressBlend",
      onLongPressMapRef: "onLongPressMap",
      occlusionLeftRef: "occlusionLeft",
      modeRef: "mode",
    })
  })

  it("Map.web publishes its reconcile closure after commit", () => {
    const component = sliceFrom(read("../Map.web.tsx"), "export const Map = React.forwardRef")
    expectWrittenInLayoutEffect(component, "reconcileRef.current = () => {")
    expectNoRenderPhaseRefWrites(component, ["reconcileRef"])
  })

  it("ReportPickMap.web", () => {
    const component = sliceFrom(read("../ReportPickMap.web.tsx"), "export const ReportPickMap = React.forwardRef")
    expectLatestValueRefs(component, {
      themeRef: "th",
      onRegionChangeRef: "onRegionChange",
      onPressPinRef: "onPressPin",
      onPressMapRef: "onPressMap",
      stateOfRef: "stateOf",
      lookForRef: "lookFor",
      pinLabelRef: "pinLabel",
      clusterLabelRef: "clusterLabel",
      focusedIdRef: "focusedId",
    })
  })

  it("ReportPickMap.web publishes its reconcile closure after commit", () => {
    const component = sliceFrom(read("../ReportPickMap.web.tsx"), "export const ReportPickMap = React.forwardRef")
    expectWrittenInLayoutEffect(component, "reconcileRef.current = () => {")
    expectNoRenderPhaseRefWrites(component, ["reconcileRef"])
  })

  it("PortraitMapPickStep.web", () => {
    const component = sliceFrom(read("../PortraitMapPickStep.web.tsx"), "export function PortraitMapPickStep(")
    expectLatestValueRefs(component, { pinRef: "pin", onConfirmRef: "onConfirm", onCancelRef: "onCancel" })
  })

  it("Map.native", () => {
    const component = sliceFrom(read("../Map.native.tsx"), "export const Map = memo(")
    expectLatestValueRefs(component, {
      userLocationRef: "userLocation",
      hapticsRef: "haptics",
      onPressPinRef: "onPressPin",
      onPressClusterRef: "onPressCluster",
      onPressCleanupRef: "onPressCleanup",
      onPressBlendRef: "onPressBlend",
      onLongPressMapRef: "onLongPressMap",
      onRegionChangeRef: "onRegionChange",
      onUserCameraMoveRef: "onUserCameraMove",
      hitMarkersRef: "hitMarkers",
      onPressMapRef: "onPressMap",
    })
  })

  it("Map.native publishes its recompute closure after commit", () => {
    const component = sliceFrom(read("../Map.native.tsx"), "export const Map = memo(")
    expectWrittenInLayoutEffect(component, "recomputeRef.current = () => {")
    expectNoRenderPhaseRefWrites(component, ["recomputeRef"])
  })

  it("ReportPickMap.native", () => {
    const component = sliceFrom(read("../ReportPickMap.native.tsx"), "export const ReportPickMap = memo(")
    expectLatestValueRefs(component, {
      hapticsRef: "haptics",
      onRegionChangeRef: "onRegionChange",
      onPressPinRef: "onPressPin",
      onPressMapRef: "onPressMap",
    })
  })

  it("ReportPickMap.native publishes its recompute closure after commit", () => {
    const component = sliceFrom(read("../ReportPickMap.native.tsx"), "export const ReportPickMap = memo(")
    expectWrittenInLayoutEffect(component, "recomputeRef.current = () => {")
    expectNoRenderPhaseRefWrites(component, ["recomputeRef"])
  })

  it("PortraitMapPickStep.native", () => {
    const component = sliceFrom(read("../PortraitMapPickStep.native.tsx"), "export function PortraitMapPickStep(")
    expectLatestValueRefs(component, { onConfirmRef: "onConfirm", onCancelRef: "onCancel" })
  })
})
