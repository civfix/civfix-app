import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { markerA11yLabel, markerButtonA11y, targetMarkerA11yLabel, type MarkerLabelT } from "../markerFocus"
import type { ClusterNode } from "../clusterer"

const t: MarkerLabelT = (key, options) => (options ? `${key}${JSON.stringify(options)}` : key)

const report = (title: string | null) =>
  ({ type: "report", key: "r", id: "r1", lat: 0, lng: 0, pin: { category: "water", title } }) as unknown as ClusterNode
const event = { id: "c1", title: "Beach day", eventKind: "cleanup" }
const eventNode = { type: "event", key: "e", id: "c1", lat: 0, lng: 0, event } as unknown as ClusterNode
const blendNode = {
  type: "blend",
  key: "b",
  id: "c1",
  lat: 0,
  lng: 0,
  event,
  reports: [{}, {}],
} as unknown as ClusterNode
const cluster = { type: "cluster", key: "k", count: 12, reportCount: 10, eventCount: 2 } as unknown as ClusterNode

describe("markerA11yLabel names every home-map marker", () => {
  it("names a report by its category and title, and by category alone when untitled or blank", () => {
    expect(markerA11yLabel(report("Burst main"), t)).toBe(
      'a11y.reportPin{"category":"enums:category.water","title":"Burst main"}',
    )
    expect(markerA11yLabel(report(null), t)).toBe('a11y.reportPinUntitled{"category":"enums:category.water"}')
    expect(markerA11yLabel(report("   "), t)).toBe('a11y.reportPinUntitled{"category":"enums:category.water"}')
  })

  it("names an event by its kind and title", () => {
    expect(markerA11yLabel(eventNode, t)).toBe('a11y.eventPin{"kind":"enums:eventKind.cleanup","title":"Beach day"}')
  })

  it("names a blend by its event and the number of reports it carries", () => {
    expect(markerA11yLabel(blendNode, t)).toBe(
      'a11y.blendPin{"event":"a11y.eventPin{\\"kind\\":\\"enums:eventKind.cleanup\\",\\"title\\":\\"Beach day\\"}","count":2}',
    )
  })

  it("counts a cluster", () => {
    expect(markerA11yLabel(cluster, t)).toBe('a11y.cluster{"count":12}')
  })

  it("names the standalone focus marker, which has no title", () => {
    expect(targetMarkerA11yLabel({ kind: "report", id: "r", lat: 0, lng: 0, category: "hazard" }, t)).toBe(
      'a11y.reportPinUntitled{"category":"enums:category.hazard"}',
    )
    expect(targetMarkerA11yLabel({ kind: "cleanup", id: "c", lat: 0, lng: 0, eventKind: "other_volunteer" }, t)).toBe(
      'a11y.eventPinUntitled{"kind":"enums:eventKind.other_volunteer"}',
    )
  })
})

// The seams need a map runtime, so the marker wiring is pinned by source.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const mapWeb = read("../Map.web.tsx")
const webMarkers = read("../domMarkerLayer.web.ts")
const webOverlays = read("../homeMapOverlays.web.tsx")
const webFocusRing = read("../mapFocusRing.web.ts")
const mapNative = read("../Map.native.tsx")
const reportPickWeb = read("../ReportPickMap.web.tsx")

describe("web markers are keyboard reachable buttons with a real name", () => {
  it("makes each marker a focusable button activated by Enter or Space", () => {
    expect(webMarkers).toContain('el.setAttribute("role", "button")')
    expect(webMarkers).toContain('el.setAttribute("tabindex", "0")')
    expect(webMarkers).toMatch(
      /el\.addEventListener\("keydown", \(e: KeyboardEvent\) => \{\n\s+if \(e\.key !== "Enter" && e\.key !== " "\) return\n\s+e\.preventDefault\(\)\n\s+e\.stopPropagation\(\)\n\s+press\(\)/,
    )
    expect(webMarkers).toMatch(/const press = \(\) => \{\n\s+beforePress\?\.\(\)\n\s+onClick\.fn\?\.\(\)/)
    expect(mapWeb).toMatch(/function endFlyToHighlight\(\): void \{\n\s+useMapFlyTo\.getState\(\)\.clear\(\)/)
    expect(mapWeb).toContain("syncMarkers(map, markersRef.current, desired, endFlyToHighlight)")
    expect(reportPickWeb).toContain("syncMarkers(map, markersRef.current, desired)")
    expect((mapWeb.match(/label: markerA11yLabel\(node, t\),/g) ?? []).length).toBe(4)
    expect((mapWeb.match(/label: targetMarkerA11yLabel\(target, t\),/g) ?? []).length).toBe(2)
  })

  it("names markers AFTER maplibre's addTo, which overwrites aria-label with a generic 'Map marker'", () => {
    expect(webMarkers).toMatch(/\.addTo\(map\)\n(\s+\/\/.*\n)?\s+el\.setAttribute\("aria-label", want\.label\)/)
    expect(webMarkers).not.toMatch(/el\.setAttribute\("aria-label", want\.label\)\n[\s\S]{0,200}new maplibregl\.Marker/)
    expect(reportPickWeb).not.toContain("new maplibregl.Marker({ element: el, anchor: want.anchor })")
    expect(webOverlays).toMatch(/\.addTo\(map\)\n\s+el\.setAttribute\("aria-label", t\("a11y\.userLocation"\)\)/)
    expect(webOverlays).toMatch(/\.addTo\(map\)\n\s+el\.setAttribute\("aria-label", t\("dropPin\.locationA11y"\)\)/)
    expect(reportPickWeb).toMatch(/\.addTo\(map\)\n\s+el\.setAttribute\("aria-label", meetingPointLabel\)/)
  })

  it("gives the labelled non-interactive elements a role that allows aria-label", () => {
    expect(webOverlays).toMatch(/className = "cf-map-user-dot"\n\s+el\.setAttribute\("role", "img"\)/)
    expect(webOverlays).toMatch(/pointerEvents = "none"\n\s+el\.setAttribute\("role", "img"\)/)
    expect(mapWeb).toMatch(/ref=\{containerRef\}\n\s+role="region"\n\s+aria-label=\{t\("a11y\.homeMap"\)\}/)
    const picker = read("../LocationPicker.web.tsx")
    expect(picker).toMatch(/style=\{styles\.canvas\}\n\s+role="region"\n\s+aria-label=\{t\("a11y\.picker"\)\}/)
  })

  it("draws the house focus ring on a focused marker", () => {
    expect(webFocusRing).toContain("`.cf-map-canvas .maplibregl-marker:focus-visible{` +")
    expect(mapWeb).toContain("ensureMapFocusRingStyle()")
  })
})

describe("native markers are accessible buttons", () => {
  it("wraps every home-map marker's pin in a labelled accessible button view", () => {
    const wrappers = mapNative.match(/<View \{\.\.\.markerButtonA11y\(label, [^)]+\)\}>/g) ?? []
    expect(wrappers).toHaveLength(6)
    expect(mapNative).toContain("const label = markerA11yLabel(node, t)")
    expect(mapNative).toContain("const label = targetMarkerA11yLabel(target, t)")
  })
})

describe("a screen reader's activate presses the native marker", () => {
  it("declares the activate action and routes it to the marker's own press with its id", () => {
    const pressed: string[] = []
    const props = markerButtonA11y("Water leak", "pin-r1", (event) => pressed.push(event.nativeEvent.id))
    expect(props).toMatchObject({
      accessible: true,
      accessibilityRole: "button",
      accessibilityLabel: "Water leak",
      accessibilityActions: [{ name: "activate" }],
    })
    props.onAccessibilityAction({ nativeEvent: { actionName: "magicTap" } })
    expect(pressed).toEqual([])
    props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } })
    expect(pressed).toEqual(["pin-r1"])
  })

  it("gives each marker kind its own press, and the focus marker the pin or cleanup press by kind", () => {
    expect(mapNative).toContain("markerButtonA11y(label, markerId, onPress)")
    expect(mapNative).toContain("markerButtonA11y(label, `cleanup-${target.id}`, onPressCleanup)")
    expect(mapNative).toContain("markerButtonA11y(label, `pin-${target.id}`, onPressPin)")
  })
})
