/**
 * The report wizard's pin-drop map must never open on the contiguous-US centroid (39.8283,-98.5795): the
 * reporter is standing next to what they report. Three causes each produce it on their own: a camera seed
 * frozen before the async `initialCenter` resolves, a pick step that seeds its point one commit late, and an
 * un-gated `flyTo` against a map that has not finished loading its style. This package has no RN renderer,
 * so the shapes are pinned by source.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reportFlowSource } from "../../bodies/reportFlow/__tests__/reportFlowSource"
import { DEVICE_FIX_TIMEOUT_MS } from "@civfix/shared"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const picker = read("../../map/LocationPicker.native.tsx")
const webPicker = read("../../map/LocationPicker.web.tsx")
const pickerTypes = read("../../map/LocationPicker.types.ts")
const pickStep = read("../../map/PortraitMapPickStep.native.tsx")

/** Source with comments stripped: the docblocks deliberately explain the removed fallback by name. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("cause 1 - the native picker has no neutral-centre fallback left", () => {
  it("does not import or reference NEUTRAL_CENTER at all", () => {
    // "No point is known yet" and "the user is in Kansas" are different facts; the picker must not
    // substitute the second for the first.
    expect(code(picker)).not.toContain("NEUTRAL_CENTER")
    expect(picker).toMatch(/import \{[^}]*\bPICKER_ZOOM,\s+PICKER_HEIGHT,[^}]*\} from "\.\/LocationPicker\.types"/)
  })

  it("mounts NO map until a real centre exists, and shows a placeholder meanwhile", () => {
    // With no map there is no camera to be wrong, so the first camera the reporter sees is already correct:
    // no opening jump, and nothing for a late resolve to race.
    expect(picker).toContain("if (!initialViewState) {")
    expect(picker).toContain("styles.pending")
    // The seed is adopted lazily (first non-null wins) and then frozen, so a later resolve cannot yank the
    // map out from under a user who has since panned.
    expect(picker).toContain("if (seedRef.current == null) seedRef.current = value ?? initialCenter ?? null")
  })

  it("no longer ships the constant AT ALL - the web seam was converted too", () => {
    // Deleted rather than deprecated: a fallback that does not exist cannot be reached for. Comments are
    // stripped so a docblock may still name the retired coordinate.
    expect(code(pickerTypes)).not.toContain("NEUTRAL_CENTER")
    expect(code(pickerTypes)).not.toContain("39.8283")
  })
})

/**
 * The web picker needs the same structure as the native seam, or mobile web opens on the centroid for the
 * same reason: lazily adopt the first real point, freeze it, and construct nothing until there is one.
 */
describe("cause 1, web - the maplibre-gl picker is not constructed until a real centre exists", () => {
  it("has no neutral-centre fallback left", () => {
    expect(code(webPicker)).not.toContain("NEUTRAL_CENTER")
    expect(webPicker).toMatch(/import \{[^}]*\bPICKER_ZOOM,\s+PICKER_HEIGHT,[^}]*\} from "\.\/LocationPicker\.types"/)
  })

  it("adopts the first real point lazily and freezes it, exactly like the native seam", () => {
    expect(webPicker).toContain("if (seedRef.current == null) seedRef.current = value ?? initialCenter ?? null")
    // The early return: no seed -> a warm placeholder and NO maplibre-gl instance, so there is no camera to
    // be wrong and nothing for a late resolve to race.
    expect(webPicker).toContain("if (!cameraSeed) {")
  })

  it("keys map construction on the seed ALONE (its cleanup removes the map)", () => {
    // The dep list is load-bearing in a way the native seam's is not: this effect's cleanup calls
    // `map.remove()`, so widening it to `value` would tear down and rebuild the map on every tap.
    expect(webPicker).toContain("}, [cameraSeed, ensureMarker])")
    expect(webPicker).toContain("if (mapRef.current || !containerRef.current || !cameraSeed) return")
  })

  it("has no un-gated recovery effect left", () => {
    // With no centroid seed to undo, an `appliedInitialRef` + late easeTo pair would only be a second camera
    // writer racing construction.
    expect(code(webPicker)).not.toContain("appliedInitialRef")
  })
})

describe("cause 2 - the pick step seeds its point in RENDER, not one commit late", () => {
  it("reconciles the open edge during render so the picker's first mount carries the draft point", () => {
    expect(pickStep).toContain("if (session.open !== visible) {")
    expect(pickStep).toContain("setSession({ open: visible, point: visible ? value ?? null : null })")
    // An effect keyed on `visible` cannot run before the commit that mounts LocationPicker, so it could only
    // correct a wrong first camera, never prevent one.
    expect(code(pickStep)).not.toContain("if (visible) setLocalPoint(value ?? null)")
    expect(code(pickStep)).not.toContain("useState<LatLng | null>(value)")
  })

  it("still hands the picker the LIVE local point (a tap must not be fought by the parent's value)", () => {
    expect(pickStep).toContain("const localPoint = session.open ? session.point : null")
    expect(pickStep).toContain("<LocationPicker")
    expect(pickStep).toContain("value={localPoint}")
  })
})

describe("cause 3 - the one remaining camera move is queued behind the map-ready signal", () => {
  it("replays a pending target from onDidFinishLoadingMap instead of firing blind", () => {
    // MapLibre ignores a flyTo issued before the map is ready and reports no error, so an un-queued
    // recenter is a SILENT no-op - the failure mode Map.native.tsx guards with mount generations and a
    // queued target. This is the same discipline in miniature.
    expect(picker).toContain("onDidFinishLoadingMap={onMapReady}")
    expect(picker).toContain("mapReadyRef.current = true")
    expect(picker).toContain("pendingCenterRef.current = value")
    expect(picker).toContain("if (mapReadyRef.current) {")
  })

  it("has no un-gated recovery effect left", () => {
    // With no centroid seed to recover from, an `appliedInitialRef` + late flyTo pair would only be a
    // second, unguarded camera writer racing the first.
    expect(code(picker)).not.toContain("appliedInitialRef")
  })
})

describe("the wizard gives the centre a head start and shares one session-wide resolve", () => {
  const wizard = reportFlowSource()

  it("arms the resolve at the shutter, not at the instant the map mounts", () => {
    // `picking` is set in the very effect that enters the location step, so gating on it alone would start
    // resolution at the moment the map needs an answer, with zero head start.
    expect(wizard).toContain(
      'hasMedia || activeStep === "location" || activeStep === "review" || picking,',
    )
  })

  it("reads and writes the SHARED user-location cache instead of a private module cache", () => {
    // A private cache never sees the point Discovery or "events near you" already resolved this session.
    // The shared key returns a resolved point synchronously and dedupes an in-flight one.
    expect(wizard).toContain("qc.getQueryData<LatLng | null>(queryKeys.userLocation)")
    expect(wizard).toContain("queryKey: queryKeys.userLocation")
    expect(code(wizard)).not.toContain("approxCenterCache")
    expect(code(wizard)).not.toContain("approxCenterPending")
  })

  it("never DOWNGRADES a point another surface already published to that shared entry", () => {
    // React Query's fetch writes whatever the queryFn resolves straight over the entry and cannot see a
    // `setQueryData` that landed mid-fetch. A bare `return null` (device denied and the IP lookup lost its
    // race) would erase the point the mobile map home seeds here, and with Infinity staleTime/gcTime and no
    // retry that null sticks for the session, so Discovery's leaderboard and nearby reports vanish. Both
    // queryFns on this key therefore end on a cache read.
    const locationHook = read("../../data/hooks/location.ts")
    const resolver = /async function resolveUserLocation\([\s\S]*?\n\}/.exec(locationHook)?.[0] ?? ""
    expect(resolver).toContain("qc: QueryClient")
    expect(resolver).toContain(
      "return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null",
    )
    // A bare `return null` tail is exactly the defect; the resolver must end on the cache read.
    expect(code(resolver).trimEnd().endsWith("}")).toBe(true)
    expect(code(resolver)).not.toMatch(/\n\s*return null\n\}/)
    // ...and the queryFn actually hands it the client (the pre-fetch `if (cached)` check is NOT the same
    // guarantee: it runs before the fetch, so it cannot see a seed that lands during it).
    expect(wizard).toContain("queryFn: () => resolveUserLocation(geo, api, qc),")
    // The hook that owns the key runs the very same resolver, so the two queryFns cannot drift.
    expect(locationHook).toContain("queryFn: () => resolveUserLocation(geo, api, qc),")
  })

  it("caps the device fix so one cold GPS read cannot park the map for the whole session", () => {
    expect(DEVICE_FIX_TIMEOUT_MS).toBe(4000)
    const locationHook = read("../../data/hooks/location.ts")
    expect(wizard).toContain('import { resolveUserLocation } from "../../data/hooks/location"')
    expect(locationHook).toContain('import { DEVICE_FIX_TIMEOUT_MS, withTimeout, type LatLng } from "@civfix/shared"')
    expect(locationHook).toContain("await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS)")
    // ...and the query must not retry: a denial that re-runs would re-prompt.
    expect(wizard).toContain("retry: false")
  })
})
