/**
 * THE "NEVER OPEN ON KANSAS" GUARD for the report wizard's pin-drop map.
 *
 * The reported defect: the picker opened on 39.8283,-98.5795 - the geographic centre of the contiguous US -
 * instead of on the reporter, who is by definition standing next to the thing they are reporting. Three
 * independent causes compounded, and a fix for any one of them alone leaves the symptom:
 *
 *   1. `LocationPicker.native` seeded its camera `value ?? initialCenter ?? NEUTRAL_CENTER` and FROZE that
 *      into a ref on the first render. Hosts resolve `initialCenter` asynchronously, so on a cold open the
 *      first render had neither input and the frozen answer was the centroid.
 *   2. `PortraitMapPickStep.native` is mounted for the whole life of the wizard and merely returns null
 *      while closed, so its `useState(value)` captured the draft point at WIZARD mount (empty) and the
 *      re-seed lived in an effect keyed on `visible` - which runs AFTER the commit that first renders the
 *      picker. So even a draft WITH a pin handed `<LocationPicker value={null}>` on the mount frame.
 *   3. recovery was one unguarded `flyTo` from an effect, with no map-ready gate and no retry, against a
 *      map that may not have finished loading its style.
 *
 * This package has no RN renderer (these are native map seams behind maplibre), so the shapes are pinned by
 * SOURCE. Each assertion below names which of the three causes it holds shut; together they are what stops
 * the centroid coming back one refactor at a time.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const picker = read("../../map/LocationPicker.native.tsx")
const webPicker = read("../../map/LocationPicker.web.tsx")
const pickerTypes = read("../../map/LocationPicker.types.ts")
const pickStep = read("../../map/PortraitMapPickStep.native.tsx")

/** Source with comments stripped: the docblocks deliberately explain the removed fallback by name. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("cause 1 - the native picker has no neutral-centre fallback left", () => {
  it("does not import or reference NEUTRAL_CENTER at all", () => {
    // The whole point: "no point is known yet" and "the user is in Kansas" are different facts, and the
    // picker may no longer substitute the second for the first.
    expect(code(picker)).not.toContain("NEUTRAL_CENTER")
    expect(picker).toContain('import { PICKER_ZOOM, PICKER_HEIGHT, type LatLng, type LocationPickerProps }')
  })

  it("mounts NO map until a real centre exists, and shows a placeholder meanwhile", () => {
    // The structural half of the fix: with no map there is no camera to be wrong, so the FIRST camera the
    // reporter ever sees is already correct - no opening jump, and nothing for a late resolve to race.
    expect(picker).toContain("if (!initialViewState) {")
    expect(picker).toContain("styles.pending")
    // The seed is adopted lazily (first non-null wins) and then frozen, so a later resolve cannot yank the
    // map out from under a user who has since panned.
    expect(picker).toContain("if (seedRef.current == null) seedRef.current = value ?? initialCenter ?? null")
  })

  it("no longer ships the constant AT ALL - the web seam was converted too", () => {
    // It survived one round as a deprecated export, kept alive only by LocationPicker.web.tsx constructing
    // its maplibre-gl instance with it. With that seam converted the constant has no callers, so it is
    // DELETED rather than left deprecated: a fallback that does not exist cannot be reached for.
    // Comment-stripped: the replacement docblock names the retired coordinate on purpose, so that the next
    // person reading the file learns what was removed and why instead of rediscovering it.
    expect(code(pickerTypes)).not.toContain("NEUTRAL_CENTER")
    expect(code(pickerTypes)).not.toContain("39.8283")
  })
})

/**
 * THE WEB HALF OF CAUSE 1. The web picker carried the identical `value ?? initialCenter ?? NEUTRAL_CENTER`
 * seed plus a late `easeTo` recovery, so mobile web opened on the centroid for exactly the same reason -
 * and "the rule applies to native only" is not a rule. It is now the same structure as the native seam:
 * lazily adopt the first real point, freeze it, and construct nothing until there is one.
 */
describe("cause 1, web - the maplibre-gl picker is not constructed until a real centre exists", () => {
  it("has no neutral-centre fallback left", () => {
    expect(code(webPicker)).not.toContain("NEUTRAL_CENTER")
    expect(webPicker).toContain(
      'import { PICKER_ZOOM, PICKER_HEIGHT, type LatLng, type LocationPickerProps }',
    )
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
    expect(webPicker).toContain("}, [cameraSeed])")
    expect(webPicker).toContain("if (mapRef.current || !containerRef.current || !cameraSeed) return")
  })

  it("has no un-gated recovery effect left", () => {
    // The `appliedInitialRef` + late easeTo pair existed ONLY to undo the centroid seed; with no seed to
    // undo it would just be a second camera writer racing construction.
    expect(code(webPicker)).not.toContain("appliedInitialRef")
  })
})

describe("cause 2 - the pick step seeds its point in RENDER, not one commit late", () => {
  it("reconciles the open edge during render so the picker's first mount carries the draft point", () => {
    expect(pickStep).toContain("if (session.open !== visible) {")
    expect(pickStep).toContain("setSession({ open: visible, point: visible ? value ?? null : null })")
    // The late effect that caused the bug must be gone: an effect keyed on `visible` cannot run before the
    // commit that mounts LocationPicker, so it could only ever CORRECT a wrong first camera, never prevent
    // one - and correcting it was cause 3's job, which is also gone.
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
    // The old `appliedInitialRef` + late flyTo pair existed ONLY to un-do the centroid seed. With the seed
    // gone there is nothing to recover from, and keeping the effect would just be a second, unguarded
    // camera writer racing the first.
    expect(code(picker)).not.toContain("appliedInitialRef")
  })
})

describe("the wizard gives the centre a head start and shares one session-wide resolve", () => {
  const wizard = read("../../bodies/ReportFlowBody.tsx")

  it("arms the resolve at the shutter, not at the instant the map mounts", () => {
    // It used to be gated on `picking`, which the location step sets in the very effect that ENTERS the
    // step - so resolution started at the exact moment the map needed an answer, i.e. with zero head start.
    expect(wizard).toContain(
      'hasMedia || activeStep === "location" || activeStep === "review" || picking,',
    )
  })

  it("reads and writes the SHARED user-location cache instead of a private module cache", () => {
    // The bespoke `approxCenterCache` never saw the point Discovery / "events near you" had already
    // resolved this session, so the report picker re-asked the device and opened on the centroid while it
    // waited. Same key = a resolved point is returned synchronously and an in-flight one is deduped.
    expect(wizard).toContain("qc.getQueryData<LatLng | null>(queryKeys.userLocation)")
    expect(wizard).toContain("queryKey: queryKeys.userLocation")
    expect(code(wizard)).not.toContain("approxCenterCache")
    expect(code(wizard)).not.toContain("approxCenterPending")
  })

  it("never DOWNGRADES a point another surface already published to that shared entry", () => {
    // Sharing the key cuts both ways, and this is the half that was missing: React Query's fetch writes
    // whatever the queryFn resolves to straight over the entry - it does not compare timestamps and it
    // cannot see a `setQueryData` that landed while the fetch was in flight. So a bare `return null` here
    // (device denied AND the IP lookup lost its race) would DELETE the point the mobile map home seeds
    // into this very entry, and with staleTime/gcTime Infinity + retry:false that null sticks for the
    // session - Discovery loses its jurisdiction, so the search tab's leaderboard and its nearby reports
    // both silently vanish. The final step is therefore a cache READ, in the same words as
    // `useUserLocation`'s queryFn (data/hooks/location.ts), which documents it as step 3 of the same
    // degradation order. Two queryFns share this key; the invariant has to hold in both.
    const resolver = /async function resolveApproxCenter\([\s\S]*?\n\}/.exec(wizard)?.[0] ?? ""
    expect(resolver).toContain("qc: QueryClient")
    expect(resolver).toContain(
      "return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null",
    )
    // A bare `return null` tail is exactly the defect - the resolver must end on the cache read.
    expect(code(resolver).trimEnd().endsWith("}")).toBe(true)
    expect(code(resolver)).not.toMatch(/\n\s*return null\n\}/)
    // ...and the queryFn actually hands it the client (the pre-fetch `if (cached)` check is NOT the same
    // guarantee: it runs before the fetch, so it cannot see a seed that lands during it).
    expect(wizard).toContain("queryFn: () => resolveApproxCenter(geo, qc),")
    // The same last step, verbatim, in the hook that owns the key - so the two cannot drift.
    expect(read("../../data/hooks/location.ts")).toContain(
      "return qc.getQueryData<LatLng | null>(queryKeys.userLocation) ?? null",
    )
  })

  it("caps the device fix so one cold GPS read cannot park the map for the whole session", () => {
    expect(wizard).toContain("const DEVICE_FIX_TIMEOUT_MS = 4000")
    expect(wizard).toContain("await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS)")
    // ...and the query must not retry: a denial that re-runs would re-prompt.
    expect(wizard).toContain("retry: false")
  })
})
