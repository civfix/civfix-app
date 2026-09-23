import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"


const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const mapHome = read("../app/index.tsx")
const viewfinder = read("../src/components/report/ReportViewfinder.tsx")
const nativeCamera = read("../src/lib/nativeCamera.ts")

function mapElementMemo(): string {
  const start = mapHome.indexOf("const mapElement = useMemo(")
  assert.ok(start > -1, "app/index.tsx no longer memoizes the map element")
  const end = mapHome.indexOf("\n  ])\n", start)
  assert.ok(end > start)
  return mapHome.slice(start, end)
}

test("the map element is memoized, and NOT on the nav view", () => {
  const memo = mapElementMemo()
  assert.ok(memo.includes("<ManagedMap"))
  const deps = memo.slice(memo.lastIndexOf("["))
  assert.ok(!/\bview\b/.test(deps), "the map memo must not depend on the nav view")
  for (const dep of ["pins", "cleanupItems", "focusedPinId", "focusedCleanupId"]) {
    assert.ok(deps.includes(dep), `the map memo dropped its ${dep} dependency`)
  }
  assert.ok(mapHome.includes("map={mapPlan.renderMap ? mapElement : null}"))
})

test("the host never hands the shared Map a basemap style - it must follow the color scheme", () => {
  assert.ok(!mapHome.includes("mapStyle"), "app/index.tsx must omit mapStyle so @civfix/ui picks it per scheme")
})

test("the map memo deliberately leaves `initialCenter` out of its dependencies", () => {
  const memo = mapElementMemo()
  assert.ok(memo.includes("mapLifecycleRef.current.lastViewport"))
  assert.ok(!memo.slice(memo.lastIndexOf("[")).includes("mapLifecycleRef"))
})

test("the resume grace softens the SESSION decision and nothing else", () => {
  assert.ok(viewfinder.includes("hostActive: active || graceHeld"))
  assert.ok(viewfinder.includes("const surfaceInputs = { ...sessionInputs, hostActive: active }"))
  assert.ok(viewfinder.includes("const sessionRunningOnSurface = cameraSessionRunning(surfaceInputs)"))
  assert.ok(viewfinder.includes("const veto = cameraSessionVeto(surfaceInputs)"))
  assert.ok(
    viewfinder.includes("startsDeferredRecording(pendingRecordRef.current, sessionRunningOnSurface, audioEnabled)"),
  )
})

test("the grace arms DURING RENDER on the leave edge - never one commit late, in an effect", () => {
  assert.ok(viewfinder.includes("const [seenActive, setSeenActive] = useState(active)"))
  assert.ok(viewfinder.includes("if (seenActive !== active) {"))
  assert.ok(
    !viewfinder.includes("!armsResumeGrace({"),
    "the arm must be a render-phase branch, not an effect guard",
  )
  const arm = viewfinder.slice(viewfinder.indexOf("if (seenActive !== active) {"))
  assert.ok(arm.includes("armsResumeGrace({"))
  assert.ok(arm.includes("setGraceHeld(true)"))
  const cancelAt = viewfinder.indexOf("if (cancelsResumeGrace(active, appState)) {")
  assert.ok(cancelAt > -1)
  const cancelEnd = viewfinder.indexOf("}", viewfinder.indexOf("setOutputsLinger", cancelAt))
  const cancelBlock = viewfinder.slice(cancelAt, cancelEnd + 1)
  assert.ok(cancelBlock.includes("setGraceHeld(false)"))
  assert.ok(cancelBlock.includes("setOutputsLinger(false)"))
  assert.ok(
    !cancelBlock.includes("setTimeout"),
    "the cancel effect must clear the grace and the linger SYNCHRONOUSLY, never on a timer",
  )
})

test("the PREVIEW stays attached for the whole grace window - a re-attach fence stalls the arrival frame ~250ms", () => {
  const previewCall = viewfinder.slice(
    viewfinder.indexOf("viewfinderPreviewEnabled({"),
    viewfinder.indexOf("viewfinderVideoOutputEnabled({"),
  )
  assert.ok(
    previewCall.includes("hostActive: active || graceHeld,"),
    "preview must ride the full grace, never the short linger",
  )
  assert.ok(!previewCall.includes("outputsLinger"))
})

test("the output linger detaches on its own bounded clock and is AND-gated on the live grace", () => {
  assert.ok(viewfinder.includes("hostActive: active || (graceHeld && outputsLinger)"))
  const clock = viewfinder.slice(viewfinder.indexOf("if (!outputsLinger) return"))
  assert.ok(clock.includes("setTimeout(() => setOutputsLinger(false), OUTPUT_DETACH_DEFER_MS)"))
  assert.ok(clock.includes("return () => clearTimeout(timer)"))
  const depsAt = clock.indexOf("}, [")
  assert.ok(depsAt > -1, "the linger clock is no longer an effect")
  assert.ok(
    clock.slice(depsAt).startsWith("}, [outputsLinger])"),
    "the linger clock must be keyed on `outputsLinger`",
  )
  const arm = viewfinder.slice(viewfinder.indexOf("if (seenActive !== active) {"))
  assert.ok(
    arm.indexOf("setOutputsLinger(true)") > -1 &&
      arm.indexOf("setOutputsLinger(true)") < arm.indexOf("}, ["),
    "the linger arms in the render-phase leave edge, alongside the grace",
  )
})

test("the grace's clock hangs off the WINDOW, so a return tears both down together", () => {
  const clock = viewfinder.slice(viewfinder.indexOf("if (!graceHeld) return"))
  assert.ok(clock.includes("setTimeout(() => setGraceHeld(false), SESSION_RESUME_GRACE_MS)"))
  assert.ok(clock.includes("return () => clearTimeout(timer)"))
  const depsAt = clock.indexOf("}, [")
  assert.ok(depsAt > -1, "the grace clock is no longer an effect")
  assert.ok(clock.slice(depsAt).startsWith("}, [graceHeld])"), "the clock must be keyed on `graceHeld`")
})

test("the camera preview draws NO location of its own - no chip, no cache, no reverse-geocode", () => {
  for (const gone of [
    "gpsChip",
    "gpsText",
    "gpsChipCache",
    "gpsChipCoords",
    "gpsChipPending",
    "readGpsChipLocation",
    "resolveGpsChipLocation",
    "locLabel",
    "gps.locating",
    "reverseLabel",
  ]) {
    assert.ok(!viewfinder.includes(gone), `the preview still carries ${gone}`)
  }
})

test("a PRE-WARMED viewfinder spends no location read and no network request", () => {
  const readers = viewfinder.match(/Location\.get(CurrentPosition|LastKnownPosition)Async/g) ?? []
  assert.equal(readers.length, 2, "only readShutterLocation may read a position")
  const shutterFn = viewfinder.slice(
    viewfinder.indexOf("async function readShutterLocation()"),
    viewfinder.indexOf("export function ReportViewfinder("),
  )
  for (const reader of readers) assert.ok(shutterFn.includes(reader))
  const callers = viewfinder.match(/readShutterLocation\(\)/g) ?? []
  assert.equal(callers.length, 2, "readShutterLocation is declared once and called once, at the shutter")
})

test("the SHUTTER still attaches the device fix - the location-step skip depends on it", () => {
  assert.ok(viewfinder.includes("async function readShutterLocation()"))
  assert.ok(viewfinder.includes("const fix = await readShutterLocation()"))
  assert.ok(
    viewfinder.includes(
      'fix ? { ...media, location: { lat: fix.lat, lng: fix.lng, source: "device" } } : media',
    ),
  )
  assert.ok(viewfinder.includes("Location.requestForegroundPermissionsAsync()"))
})

test("the photo shutter asks the library to stay silent", () => {
  const take = viewfinder.slice(
    viewfinder.indexOf("const onTakePhoto = useCallback"),
    viewfinder.indexOf("const beginRecording = useCallback"),
  )
  assert.ok(take.includes("enableShutterSound: false"))
  assert.ok(take.includes('flash: "off"'))
})

test("the stale-temp sweep waits out the pop on a real clock, not on runAfterInteractions", () => {
  assert.ok(
    !nativeCamera.includes("InteractionManager"),
    "runAfterInteractions is a bare setImmediate under RN 0.81 - it defers nothing",
  )
  assert.ok(nativeCamera.includes("const SWEEP_DELAY_MS = motion.pagePop.duration"))
  assert.ok(nativeCamera.includes("}, SWEEP_DELAY_MS)"))
})

test("the sweep yields between directories, so one turn is never two full scans", () => {
  const sweep = nativeCamera.slice(nativeCamera.indexOf("function sweepStaleMediaTempFiles()"))
  const body = sweep.slice(0, sweep.indexOf("\n}\n"))
  assert.equal((body.match(/setTimeout\(/g) ?? []).length, 2)
  assert.ok(body.includes("}, 0)"))
})
