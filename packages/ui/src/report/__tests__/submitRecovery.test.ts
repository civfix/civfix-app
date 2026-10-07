import { beforeEach, describe, expect, it } from "vitest"
import { AppError, ErrorCode, CreateReportRequestSchema, MAX_REPORT_DESCRIPTION_LENGTH } from "@civfix/shared"
import { STEP_ORDER_COMPACT, STEP_ORDER_EXPANDED, stepOrderFor, submitErrorRecovery } from "../wizardSteps"
import {
  composeDescription,
  createSubmitRunSlot,
  descriptionMaxLength,
  invalidatesUploadIds,
} from "../submit"
import { useDraftReportStore } from "../draftStore"
import { adoptViewer, discardViewerDrafts } from "../../viewerScope"

const BOTH_FLAGS = { blockingSidewalk: true, safetyHazard: true }
const NO_FLAGS = { blockingSidewalk: false, safetyHazard: false }

describe("a refused submission offers a way to change the report", () => {
  it("sends a slur-filtered title or description to the details step without a looping retry", () => {
    expect(submitErrorRecovery("VALIDATION", { title: "not allowed" }, STEP_ORDER_COMPACT)).toEqual({
      retryable: false,
      editStep: "details",
    })
    expect(submitErrorRecovery("VALIDATION", { description: "not allowed" }, STEP_ORDER_EXPANDED)).toEqual({
      retryable: false,
      editStep: "details",
    })
  })

  it("sends an unclaimable upload to the capture step and still lets a re-upload retry", () => {
    expect(
      submitErrorRecovery("VALIDATION", { mediaUploadIds: "One or more media uploads are unavailable." }, STEP_ORDER_COMPACT),
    ).toEqual({ retryable: true, editStep: "capture" })
    expect(submitErrorRecovery("MEDIA_REJECTED", undefined, STEP_ORDER_COMPACT)).toEqual({
      retryable: false,
      editStep: "capture",
    })
  })

  it("routes a location refusal to the location step, or to review where the layout has none", () => {
    expect(submitErrorRecovery("GPS_IMPLAUSIBLE", undefined, STEP_ORDER_COMPACT).editStep).toBe("location")
    expect(submitErrorRecovery("VALIDATION", { lat: "bad" }, STEP_ORDER_EXPANDED).editStep).toBe("review")
    expect(
      submitErrorRecovery("NOT_ROUTABLE", undefined, stepOrderFor("compact", { skipLocation: true })).editStep,
    ).toBe("review")
    expect(submitErrorRecovery("VALIDATION", { addr: "not allowed" }, STEP_ORDER_COMPACT).editStep).toBe("review")
  })

  it("matches nested zod field paths by their first segment", () => {
    expect(submitErrorRecovery("VALIDATION", { "mediaUploadIds.0": "Invalid" }, STEP_ORDER_COMPACT).editStep).toBe(
      "capture",
    )
  })

  it("keeps Try again for transient failures, with review as the edit target", () => {
    for (const code of ["INTERNAL", "RATE_LIMITED", "TURNSTILE_FAILED", "UNAUTHORIZED", undefined]) {
      expect(submitErrorRecovery(code, undefined, STEP_ORDER_COMPACT)).toEqual({
        retryable: true,
        editStep: "review",
      })
    }
  })
})

describe("stale upload ids are dropped after the server refuses them", () => {
  beforeEach(() => useDraftReportStore.getState().reset())

  it("recognises only a VALIDATION that names mediaUploadIds", () => {
    expect(invalidatesUploadIds(AppError.validation({ mediaUploadIds: "unavailable" }))).toBe(true)
    expect(invalidatesUploadIds(AppError.validation({ "mediaUploadIds.1": "Invalid" }))).toBe(true)
    expect(invalidatesUploadIds(AppError.validation({ title: "not allowed" }))).toBe(false)
    expect(invalidatesUploadIds(new AppError(ErrorCode.INTERNAL, "boom"))).toBe(false)
    expect(invalidatesUploadIds(new Error("offline"))).toBe(false)
  })

  it("clearMediaUploadIds forgets every cached upload id and keeps the media", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture({ uri: "a", kind: "image", mime: "image/jpeg" })
    s.addCapture({ uri: "b", kind: "image", mime: "image/jpeg" })
    const [a, b] = useDraftReportStore.getState().draft.media
    s.setMediaUploadId(a!.id, "up-a")
    s.setMediaUploadId(b!.id, "up-b")
    s.clearMediaUploadIds()
    const media = useDraftReportStore.getState().draft.media
    expect(media.map((m) => m.uri)).toEqual(["a", "b"])
    expect(media.every((m) => m.uploadId === undefined)).toBe(true)
  })
})

describe("the description field leaves room for the flag notes", () => {
  it("keeps a full-length description plus both flags inside the contract limit", () => {
    const max = descriptionMaxLength(BOTH_FLAGS)
    expect(max).toBeLessThan(MAX_REPORT_DESCRIPTION_LENGTH)
    const composed = composeDescription({ description: "x".repeat(max), flags: BOTH_FLAGS })
    expect(composed?.length).toBe(MAX_REPORT_DESCRIPTION_LENGTH)
    expect(CreateReportRequestSchema.shape.description.safeParse(composed).success).toBe(true)
    const over = composeDescription({ description: "x".repeat(max + 1), flags: BOTH_FLAGS })
    expect(CreateReportRequestSchema.shape.description.safeParse(over).success).toBe(false)
  })

  it("gives the whole budget back when no flag is on, and matches each single flag exactly", () => {
    expect(descriptionMaxLength(NO_FLAGS)).toBe(MAX_REPORT_DESCRIPTION_LENGTH)
    for (const flags of [
      { blockingSidewalk: true, safetyHazard: false },
      { blockingSidewalk: false, safetyHazard: true },
    ]) {
      const composed = composeDescription({ description: "x".repeat(descriptionMaxLength(flags)), flags })
      expect(composed?.length).toBe(MAX_REPORT_DESCRIPTION_LENGTH)
    }
  })
})

describe("one submission at a time, surviving a remount", () => {
  function deferred<T>() {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it("refuses a second start while the first run is in flight", async () => {
    const slot = createSubmitRunSlot<string>()
    const gate = deferred<string>()
    let calls = 0
    const first = slot.start(() => {
      calls++
      return gate.promise
    })
    expect(first).not.toBeNull()
    expect(slot.start(async () => "second")).toBeNull()
    gate.resolve("done")
    await expect(first).resolves.toBe("done")
    expect(calls).toBe(1)
    expect(slot.start(async () => "again")).not.toBeNull()
  })

  it("keeps a run nobody claimed so a remounted body can show its outcome", async () => {
    const slot = createSubmitRunSlot<string>()
    const run = slot.start(async () => "filed")!
    await run
    expect(slot.unclaimed()).toBe(run)
    slot.claim(run)
    expect(slot.unclaimed()).toBeNull()
  })
})

describe("a submission belongs to the viewer who started it", () => {
  function deferred<T>() {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  beforeEach(() => {
    adoptViewer(null)
    discardViewerDrafts()
  })

  it("drops A's run on sign-out: B's flow finds nothing to adopt and the task learns it was discarded", async () => {
    adoptViewer("user-a")
    const slot = createSubmitRunSlot<string>()
    const gate = deferred<void>()
    let stillCurrent: boolean | null = null
    const run = slot.start(async (isCurrent) => {
      await gate.promise
      stillCurrent = isCurrent()
      return "filed by A"
    })!

    discardViewerDrafts()
    adoptViewer(null)
    adoptViewer("user-b")

    expect(slot.unclaimed()).toBeNull()
    gate.resolve()
    await run
    expect(stillCurrent).toBe(false)
    expect(slot.unclaimed()).toBeNull()
    expect(slot.claim(run)).toBe(false)
    expect(slot.start(async () => "B's own report")).not.toBeNull()
  })

  it("drops A's run on a switch to another account without a sign-out in between", async () => {
    adoptViewer("user-a")
    const slot = createSubmitRunSlot<string>()
    const run = slot.start(async () => "filed by A")!
    adoptViewer("user-b")
    await run
    expect(slot.unclaimed()).toBeNull()
  })

  it("keeps the run through a transient loss of the same viewer", async () => {
    adoptViewer("user-a")
    const slot = createSubmitRunSlot<string>()
    const run = slot.start(async (isCurrent) => (isCurrent() ? "current" : "discarded"))!
    adoptViewer(null)
    adoptViewer("user-a")
    await expect(run).resolves.toBe("current")
    expect(slot.unclaimed()).toBe(run)
    expect(slot.claim(run)).toBe(true)
  })

  it("never leaves a run that claims itself (a composer hand-off) for the next mount to adopt", async () => {
    const slot = createSubmitRunSlot<{ kind: string }>({ claimsItself: (settled) => settled.kind === "composer" })
    await slot.start(async () => ({ kind: "composer" }))
    expect(slot.unclaimed()).toBeNull()

    const failed = slot.start(async () => ({ kind: "error" }))!
    await failed
    expect(slot.unclaimed()).toBe(failed)
  })
})
