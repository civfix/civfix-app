import { test } from "node:test"
import assert from "node:assert/strict"
import {
  SCAN_DEBOUNCE_MS,
  acceptsScannedCode,
  armsResumeGrace,
  cameraSessionRunning,
  firstCodeValue,
  cameraSessionVeto,
  cancelsResumeGrace,
  dropsParkedRecording,
  micDeferralAction,
  parkIsStale,
  startsDeferredRecording,
  viewfinderPreviewEnabled,
  viewfinderVideoOutputEnabled,
  BACKGROUNDED_PARK_GRACE_MS,
  MAX_VIDEO_SECONDS,
  OUTPUT_DETACH_DEFER_MS,
  SESSION_RESUME_GRACE_MS,
  type CameraSessionInputs,
  type ResumeGraceInputs,
  type ViewfinderOutputInputs,
} from "./cameraSession.ts"

const ready: CameraSessionInputs = {
  hostActive: true,
  appState: "active",
  hasPermission: true,
  hasDevice: true,
}

test("the session runs only when the host, the app, the permission AND a device all say yes", () => {
  assert.equal(cameraSessionRunning(ready), true)
  assert.equal(cameraSessionRunning({ ...ready, hostActive: false }), false)
  assert.equal(cameraSessionRunning({ ...ready, hasPermission: false }), false)
  assert.equal(cameraSessionRunning({ ...ready, hasDevice: false }), false)
})

test("the session releases on EVERY non-active app state, not just background", () => {
  for (const appState of ["background", "inactive", "unknown", "extension"] as const) {
    assert.equal(cameraSessionRunning({ ...ready, appState }), false, appState)
  }
})

test("a shutter tap with audio already committed records immediately", () => {
  assert.equal(micDeferralAction({ audioEnabled: true, granted: false }), "record-now")
  assert.equal(micDeferralAction({ audioEnabled: true, granted: true }), "record-now")
})

test("a FRESH mic grant DEFERS the clip until the audio prop has committed", () => {
  assert.equal(micDeferralAction({ audioEnabled: false, granted: true }), "defer-until-audio-commits")
})

test("a DECLINED mic permission still records - just without audio", () => {
  assert.equal(micDeferralAction({ audioEnabled: false, granted: false }), "record-without-audio")
})

test("a parked clip WAITS for the session instead of being thrown away", () => {
  assert.equal(startsDeferredRecording(true, true, true), true)
  assert.equal(startsDeferredRecording(true, false, true), false)
  assert.equal(startsDeferredRecording(false, true, true), false)
})

test("Finding 1 - sessionRunning true is NOT proof the audio prop has committed, so the park must still wait", () => {
  assert.equal(startsDeferredRecording(true, true, false), false)
  assert.equal(startsDeferredRecording(true, true, true), true)
})

test("cameraSessionVeto names WHY the session can't run, not just THAT it can't", () => {
  assert.equal(cameraSessionVeto(ready), "none")
  assert.equal(cameraSessionVeto({ ...ready, hostActive: false }), "left-surface")
  assert.equal(cameraSessionVeto({ ...ready, appState: "inactive" }), "transient-inactive")
  for (const appState of ["background", "unknown", "extension"] as const) {
    assert.equal(cameraSessionVeto({ ...ready, appState }), "backgrounded", appState)
  }
  assert.equal(cameraSessionVeto({ ...ready, hasPermission: false }), "no-permission")
  assert.equal(cameraSessionVeto({ ...ready, hasDevice: false }), "no-device")
})

test("cameraSessionRunning stays the boolean projection of cameraSessionVeto('none')", () => {
  assert.equal(cameraSessionRunning(ready), cameraSessionVeto(ready) === "none")
  assert.equal(
    cameraSessionRunning({ ...ready, hostActive: false }),
    cameraSessionVeto({ ...ready, hostActive: false }) === "none",
  )
})

test("Finding 2 - only the TRANSIENT blip waits; every other veto DROPS the park", () => {
  const pastGrace = BACKGROUNDED_PARK_GRACE_MS + 1000
  assert.equal(dropsParkedRecording("transient-inactive", pastGrace), false)
  assert.equal(dropsParkedRecording("none", pastGrace), false)
  assert.equal(dropsParkedRecording("left-surface", pastGrace), true)
  assert.equal(dropsParkedRecording("backgrounded", pastGrace), true)
  assert.equal(dropsParkedRecording("no-permission", pastGrace), true)
  assert.equal(dropsParkedRecording("no-device", pastGrace), true)
})

test("Finding 2 - the exact reachable sequence: leaving the Report tab drops the park instead of firing minutes later", () => {
  const leftTheTab: CameraSessionInputs = { ...ready, hostActive: false }
  assert.equal(cameraSessionRunning(leftTheTab), false)
  assert.equal(dropsParkedRecording(cameraSessionVeto(leftTheTab), 0), true)
})

test("Finding 2 - backgrounding the app (not just a transient blip) also drops the park, once the grace has elapsed", () => {
  const backgrounded: CameraSessionInputs = { ...ready, appState: "background" }
  assert.equal(dropsParkedRecording(cameraSessionVeto(backgrounded), BACKGROUNDED_PARK_GRACE_MS), true)
  const transientBlip: CameraSessionInputs = { ...ready, appState: "inactive" }
  assert.equal(dropsParkedRecording(cameraSessionVeto(transientBlip), BACKGROUNDED_PARK_GRACE_MS + 1000), false)
})

test("Finding B - a park just after the timestamp still waits on 'backgrounded', not an instant drop", () => {
  const androidDialogBackground: CameraSessionInputs = { ...ready, appState: "background" }
  const veto = cameraSessionVeto(androidDialogBackground)
  assert.equal(veto, "backgrounded")
  assert.equal(dropsParkedRecording(veto, 0), false)
  assert.equal(dropsParkedRecording(veto, BACKGROUNDED_PARK_GRACE_MS - 1), false)
})

test("Finding B - a park well past the grace threshold drops, even without ever having been re-checked before", () => {
  assert.equal(dropsParkedRecording("backgrounded", BACKGROUNDED_PARK_GRACE_MS), true)
  assert.equal(dropsParkedRecording("backgrounded", BACKGROUNDED_PARK_GRACE_MS + 60_000), true)
})

test("Android permission-dialog race - the grace never starts a recording by itself; the session still has to return", () => {
  assert.equal(startsDeferredRecording(true, false, true), false)
})

test("Finding B - 'left-surface' drops regardless of elapsed time; the grace never extends to it", () => {
  const leftTheTab: CameraSessionInputs = { ...ready, hostActive: false }
  const veto = cameraSessionVeto(leftTheTab)
  assert.equal(veto, "left-surface")
  assert.equal(dropsParkedRecording(veto, 0), true)
  assert.equal(dropsParkedRecording(veto, BACKGROUNDED_PARK_GRACE_MS + 1000), true)
})

test("Finding B - BACKGROUNDED_PARK_GRACE_MS is a small, deliberate window, not a stand-in for 'no grace'", () => {
  assert.equal(BACKGROUNDED_PARK_GRACE_MS, 2000)
})

test("Finding 1 / Finding 3 - a stale park is refused at the START, independent of msSinceParked's exact veto", () => {
  assert.equal(parkIsStale(0), false)
  assert.equal(parkIsStale(BACKGROUNDED_PARK_GRACE_MS - 1), false)
  assert.equal(parkIsStale(BACKGROUNDED_PARK_GRACE_MS), true)
  assert.equal(parkIsStale(BACKGROUNDED_PARK_GRACE_MS + 5 * 60_000), true)
})

test("Finding 3 - the exact reachable sequence: the app switcher left open for minutes does not protect a stale park", () => {
  const fiveMinutes = 5 * 60_000
  assert.equal(dropsParkedRecording("transient-inactive", fiveMinutes), false)
  assert.equal(parkIsStale(fiveMinutes), true)
})

test("Finding 1 - the exact reachable sequence: returning from background minutes later reads veto 'none', which dropsParkedRecording alone would not drop", () => {
  const fiveMinutes = 5 * 60_000
  assert.equal(dropsParkedRecording("none", fiveMinutes), false)
  assert.equal(parkIsStale(fiveMinutes), true)
})

test("Finding 1 / Finding 3 - a genuinely fresh park is never mistaken for stale (no regression on the Android permission-dialog grace)", () => {
  assert.equal(parkIsStale(150), false)
})

test("Finding 3 - MAX_VIDEO_SECONDS is pinned to the design's 10s cap", () => {
  assert.equal(MAX_VIDEO_SECONDS, 10)
})


const glance: ResumeGraceInputs = {
  hostActive: false,
  graceEligible: true,
  everRan: true,
  appState: "active",
  recordingBusy: false,
}

test("the grace arms on the ONE case it exists for: a live camera the reporter tabbed away from", () => {
  assert.equal(armsResumeGrace(glance), true)
})

test("the grace never arms while the reporter is still ON the surface", () => {
  assert.equal(armsResumeGrace({ ...glance, hostActive: true }), false)
})

test("the grace refuses every leave the SHARED side did not call a glance", () => {
  assert.equal(armsResumeGrace({ ...glance, graceEligible: false }), false)
})

test("the grace never arms for a camera that has never actually run", () => {
  assert.equal(armsResumeGrace({ ...glance, everRan: false }), false)
})

test("the grace never arms while a recording is in flight or parked - 'left-surface' stays decisive", () => {
  assert.equal(armsResumeGrace({ ...glance, recordingBusy: true }), false)
  assert.equal(dropsParkedRecording("left-surface", 0), true)
})

test("the grace never arms while the app is anywhere but the foreground", () => {
  for (const appState of ["background", "inactive", "unknown", "extension"] as const) {
    assert.equal(armsResumeGrace({ ...glance, appState }), false, appState)
  }
})

test("a running grace is CANCELLED by the reporter returning, and by the app leaving the foreground", () => {
  assert.equal(cancelsResumeGrace(true, "active"), true)
  for (const appState of ["background", "inactive", "unknown", "extension"] as const) {
    assert.equal(cancelsResumeGrace(false, appState), true, appState)
  }
  assert.equal(cancelsResumeGrace(false, "active"), false)
})

test("the grace window is bounded, and short enough that the lit camera indicator is measured in seconds", () => {
  assert.equal(SESSION_RESUME_GRACE_MS, 10_000)
  assert.ok(SESSION_RESUME_GRACE_MS >= 5_000 && SESSION_RESUME_GRACE_MS <= 15_000)
})

test("the output-detach defer outlasts the body entrance and stays far inside the grace window", () => {
  assert.ok(OUTPUT_DETACH_DEFER_MS >= 250 && OUTPUT_DETACH_DEFER_MS <= 1_000)
  assert.ok(OUTPUT_DETACH_DEFER_MS < SESSION_RESUME_GRACE_MS / 10)
})


const lookingVideo: ViewfinderOutputInputs = {
  hostActive: true,
  mode: "video",
  recordingBusy: false,
}

test("on-surface, both outputs run - the viewfinder is being looked at", () => {
  assert.equal(viewfinderPreviewEnabled(lookingVideo), true)
  assert.equal(viewfinderVideoOutputEnabled(lookingVideo), true)
  const lookingPhoto: ViewfinderOutputInputs = { ...lookingVideo, mode: "photo" }
  assert.equal(viewfinderPreviewEnabled(lookingPhoto), true)
  assert.equal(viewfinderVideoOutputEnabled(lookingPhoto), false)
})

test("grace-held photo mode: the session may run, but preview AND video output are both off", () => {
  assert.equal(cameraSessionRunning({ ...ready, hostActive: true }), true)
  const graced: ViewfinderOutputInputs = { hostActive: false, mode: "photo", recordingBusy: false }
  assert.equal(viewfinderPreviewEnabled(graced), false)
  assert.equal(viewfinderVideoOutputEnabled(graced), false)
})

test("grace-held video mode with no recording: the full-rate video output drops too", () => {
  const graced: ViewfinderOutputInputs = { hostActive: false, mode: "video", recordingBusy: false }
  assert.equal(viewfinderVideoOutputEnabled(graced), false)
})

test("a recording in flight (or parked) keeps the video output attached, REGARDLESS of everything else", () => {
  assert.equal(viewfinderVideoOutputEnabled({ ...lookingVideo, recordingBusy: true }), true)
  assert.equal(
    viewfinderVideoOutputEnabled({ hostActive: false, mode: "video", recordingBusy: true }),
    true,
  )
  assert.equal(
    viewfinderVideoOutputEnabled({ hostActive: false, mode: "photo", recordingBusy: true }),
    true,
  )
  assert.equal(armsResumeGrace({ ...glance, recordingBusy: true }), false)
})

test("returning WITHIN the grace flips the preview back on - same commit, no cold start", () => {
  assert.equal(viewfinderPreviewEnabled({ ...lookingVideo, hostActive: true }), true)
  assert.equal(viewfinderVideoOutputEnabled({ ...lookingVideo, hostActive: true }), true)
  assert.equal(cancelsResumeGrace(true, "active"), true)
})

test("the grace is orthogonal to the veto vocabulary - it never renames a reason the session is down", () => {
  assert.equal(cameraSessionVeto({ ...ready, hostActive: false }), "left-surface")
  assert.equal(cameraSessionVeto({ ...ready, hostActive: true }), "none")
})

test("the scanner reads the first usable code in the frame and ignores the empty ones", () => {
  assert.equal(firstCodeValue(null), null)
  assert.equal(firstCodeValue([]), null)
  assert.equal(firstCodeValue([{ value: null }, { value: "  " }, { value: " tok-1 " }]), "tok-1")
  assert.equal(firstCodeValue([{ value: "tok-1" }, { value: "tok-2" }]), "tok-1")
})

test("holding the camera on ONE ticket fires once, not once per frame", () => {
  const first = { value: "tok-1", lastValue: null, lastAt: 0, now: 1000 }
  assert.equal(acceptsScannedCode(first), true)
  assert.equal(
    acceptsScannedCode({ value: "tok-1", lastValue: "tok-1", lastAt: 1000, now: 1200 }),
    false,
  )
  assert.equal(
    acceptsScannedCode({
      value: "tok-1",
      lastValue: "tok-1",
      lastAt: 1000,
      now: 1000 + SCAN_DEBOUNCE_MS,
    }),
    true,
  )
})

test("the next ticket in the queue is never debounced behind the previous one", () => {
  assert.equal(
    acceptsScannedCode({ value: "tok-2", lastValue: "tok-1", lastAt: 1000, now: 1010 }),
    true,
  )
  assert.equal(acceptsScannedCode({ value: "", lastValue: null, lastAt: 0, now: 5000 }), false)
})
