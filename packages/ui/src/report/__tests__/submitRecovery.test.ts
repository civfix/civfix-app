import { beforeEach, describe, expect, it } from "vitest"
import { AppError, ErrorCode, CreateReportRequestSchema } from "@civfix/shared"
import { STEP_ORDER_COMPACT, STEP_ORDER_EXPANDED, stepOrderFor, submitErrorRecovery } from "../wizardSteps"
import {
  REPORT_DESCRIPTION_MAX,
  composeDescription,
  createSubmitRunSlot,
  descriptionMaxLength,
  invalidatesUploadIds,
} from "../submit"
import { useDraftReportStore } from "../draftStore"

const BOTH_FLAGS = { blockingSidewalk: true, safetyHazard: true }
const NO_FLAGS = { blockingSidewalk: false, safetyHazard: false }

describe("a refused submission offers a way to change the report (APP-BUG-157)", () => {
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

describe("stale upload ids are dropped after the server refuses them (APP-BUG-158)", () => {
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

describe("the description field leaves room for the flag notes (APP-BUG-159)", () => {
  it("keeps a full-length description plus both flags inside the contract limit", () => {
    const max = descriptionMaxLength(BOTH_FLAGS)
    expect(max).toBeLessThan(REPORT_DESCRIPTION_MAX)
    const composed = composeDescription({ description: "x".repeat(max), flags: BOTH_FLAGS })
    expect(composed?.length).toBe(REPORT_DESCRIPTION_MAX)
    expect(CreateReportRequestSchema.shape.description.safeParse(composed).success).toBe(true)
    const over = composeDescription({ description: "x".repeat(max + 1), flags: BOTH_FLAGS })
    expect(CreateReportRequestSchema.shape.description.safeParse(over).success).toBe(false)
  })

  it("gives the whole budget back when no flag is on, and matches each single flag exactly", () => {
    expect(descriptionMaxLength(NO_FLAGS)).toBe(REPORT_DESCRIPTION_MAX)
    for (const flags of [
      { blockingSidewalk: true, safetyHazard: false },
      { blockingSidewalk: false, safetyHazard: true },
    ]) {
      const composed = composeDescription({ description: "x".repeat(descriptionMaxLength(flags)), flags })
      expect(composed?.length).toBe(REPORT_DESCRIPTION_MAX)
    }
  })
})

describe("one submission at a time, surviving a remount (APP-BUG-168, APP-BUG-169)", () => {
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
