import { describe, expect, it, vi } from "vitest"
import type { DetailEntry } from "../../nav"
import type { CleanupFormValue } from "../CleanupForm"
import type { DraftReport } from "../../report/draftStore"
import {
  applyHostSeedPoint,
  commitHostDraftMount,
  isGenuineHostExit,
  planDropPinReportSeed,
  planHostDraftMount,
  shouldMergeSeedIntoDraft,
  type HostDraftSnapshot,
  type HostDraftTarget,
} from "../cleanupDraftExit"

const hostEntry: DetailEntry = { kind: "create-cleanup" }
const reportEntry: DetailEntry = { kind: "pin", id: "report-a" }

describe("host-draft exit", () => {
  it("keeps the draft when the form is still on the stack under a forward drill-down", () => {
    expect(isGenuineHostExit([hostEntry, reportEntry])).toBe(false)
  })

  it("clears the draft when backing out onto the report the flow was launched from", () => {
    // The regression: back() pops the create-cleanup entry, leaving a report detail on top. Reading only
    // the TOP entry saw kind "report" and kept the draft, which then hijacked the next host flow.
    expect(isGenuineHostExit([reportEntry])).toBe(true)
  })

  it("clears the draft when the stack empties (home / a list view / tab switch)", () => {
    expect(isGenuineHostExit([])).toBe(true)
  })

  it("merges the new seed when re-entering the flow from a different report", () => {
    expect(shouldMergeSeedIntoDraft(true, "report-a", "report-b")).toBe(true)
    // An UNSEEDED draft (hosted from the events list) that is then re-entered through a report: still a
    // merge, never a clear - the host's typed fields survive and the report is simply linked in.
    expect(shouldMergeSeedIntoDraft(true, undefined, "report-b")).toBe(true)
  })

  it("resumes the same draft untouched for the same launching report or an unseeded re-entry", () => {
    expect(shouldMergeSeedIntoDraft(true, "report-a", "report-a")).toBe(false)
    // "Back to your event" pushes create-cleanup with no reportId.
    expect(shouldMergeSeedIntoDraft(true, "report-a", undefined)).toBe(false)
  })

  it("never merges when no draft is in progress (begin() seeds the fresh draft instead)", () => {
    expect(shouldMergeSeedIntoDraft(false, undefined, "report-b")).toBe(false)
  })
})

/** A typed-in host draft, so the seed-point tests can prove nothing else is disturbed. */
function typedForm(over: Partial<CleanupFormValue> = {}): CleanupFormValue {
  return {
    organizationId: null,
    title: "Beach cleanup",
    description: "Bring gloves",
    eventKind: "cleanup",
    addrQuery: "Ocean Beach",
    spot: "By the north lot",
    coords: { lat: 10, lng: 20 },
    date: null,
    time: null,
    endTime: null,
    bring: ["gloves"],
    // Signup slots ride in the draft exactly like `bring`: plain strings plus a stable local key.
    slots: [
      {
        key: "slot-1",
        title: "Check-in table",
        description: "Greet arrivals",
        capacity: "2",
        startsAt: null,
        endsAt: null,
      },
    ],
    linkedReportIds: ["report-a"],
    shareToFeed: true,
    feedCaption: "",
    ...over,
  }
}

/** A HostDraftTarget spy: `begin` is a NO-OP while a draft is active, exactly like the real store. */
function draftTarget(live: CleanupFormValue | null, linked: string[] = []) {
  const begun: CleanupFormValue[] = []
  const toggled: string[] = []
  const patched: CleanupFormValue[] = []
  const target: HostDraftTarget = {
    value: live,
    isLinked: (id) => linked.includes(id),
    toggleLinkedReport: (id) => {
      toggled.push(id)
    },
    begin: (initial) => {
      if (!live) begun.push(initial)
    },
    patch: (value) => {
      patched.push(value)
    },
  }
  return { target, begun, toggled, patched }
}

describe("the host form's mount step carries `slots` verbatim", () => {
  it("hands a FRESH draft the initial value untouched - slots included", () => {
    const { target, begun } = draftTarget(null)
    const initial = typedForm()
    const plan = planHostDraftMount({ active: false, value: null }, undefined, undefined, initial)
    expect(plan.startedFresh).toBe(true)
    commitHostDraftMount(target, plan)
    // Identity, not deep-equality: nothing here may rebuild, re-key or re-sort a slot draft. A re-keyed
    // card remounts its TextInputs mid-edit and the host loses their caret (and, on web, their IME).
    expect(begun).toHaveLength(1)
    expect(begun[0]).toBe(initial)
    expect(begun[0]?.slots).toBe(initial.slots)
    // ...and the value the form renders before the commit lands is that same object.
    expect(plan.value).toBe(initial)
  })

  it("MERGES a new seed report into a live draft without touching its slots", () => {
    // The regression this guards: re-entering "Host an event" from a different report must link that
    // report and change nothing else. `begin` no-ops while active, so the typed slots simply survive.
    const live = typedForm()
    const { target, begun, toggled } = draftTarget(live)
    const plan = planHostDraftMount({ active: true, value: live }, "report-b", "report-a", typedForm())
    expect(plan.startedFresh).toBe(false)
    expect(plan.seedReportId).toBe("report-b")
    commitHostDraftMount(target, plan)
    expect(toggled).toEqual(["report-b"])
    expect(begun).toEqual([])
    // The RENDERED value merges the link and nothing else - the slot array is the very same reference.
    expect(plan.value.linkedReportIds).toEqual(["report-a", "report-b"])
    expect(plan.value.slots).toBe(live.slots)
    expect(plan.value.title).toBe("Beach cleanup")
  })

  it("keeps the draft (and therefore its slots) alive under a forward drill-down", () => {
    // Slots live in the persisted CleanupFormValue, so "do the slots survive?" IS "is the draft kept?".
    expect(isGenuineHostExit([hostEntry, reportEntry])).toBe(false)
    // ...and a genuine exit clears the whole draft, slots with it.
    expect(isGenuineHostExit([reportEntry])).toBe(true)
  })
})

/**
 * `planHostDraftMount` runs during RENDER, so it must be a pure function of its arguments. A single write
 * from here reaches every subscriber of the draft store mid-render - which is the crash this split fixed:
 * "Cannot update a component (`ReportDetailContent`) while rendering a different component (`HostForm`)".
 */
describe("planHostDraftMount writes nothing", () => {
  it("touches no store operation on a fresh mount, a merge, or a resume", () => {
    // The planner is handed the WHOLE store (that is what `useCleanupDraft.getState()` is), with every
    // write rigged to throw. Reaching for one is the bug, so it fails the test rather than being asserted
    // after the fact.
    const boom = (op: string) => () => {
      throw new Error(`planHostDraftMount wrote the store: ${op}`)
    }
    const readOnly = (live: CleanupFormValue | null): HostDraftSnapshot & HostDraftTarget => ({
      active: live !== null,
      value: live,
      isLinked: () => false,
      toggleLinkedReport: boom("toggleLinkedReport"),
      begin: boom("begin"),
      patch: boom("patch"),
    })
    const live = typedForm()
    expect(() => {
      planHostDraftMount(readOnly(null), "report-a", undefined, typedForm())
      planHostDraftMount(readOnly(live), "report-b", "report-a", typedForm(), { lat: 1, lng: 2 })
      planHostDraftMount(readOnly(live), undefined, "report-a", typedForm())
    }).not.toThrow()
  })

  it("plans the pressed point onto a RESUMED draft, and nothing at all for the same point", () => {
    const live = typedForm({ coords: { lat: 10, lng: 20 } })
    const moved = planHostDraftMount({ active: true, value: live }, undefined, undefined, typedForm(), {
      lat: 1,
      lng: 2,
    })
    expect(moved.movePointTo).toEqual({ lat: 1, lng: 2 })
    expect(moved.value.coords).toEqual({ lat: 1, lng: 2 })
    expect(moved.value.title).toBe("Beach cleanup")

    const same = planHostDraftMount({ active: true, value: live }, undefined, undefined, typedForm(), {
      lat: 10,
      lng: 20,
    })
    expect(same.movePointTo).toBeUndefined()
    // Same object back: an unchanged resume must not hand the form a new value to re-render against.
    expect(same.value).toBe(live)
  })

  it("never plans a link for a report the host already added from its detail", () => {
    const live = typedForm({ linkedReportIds: ["report-a", "report-b"] })
    const plan = planHostDraftMount({ active: true, value: live }, "report-b", "report-a", typedForm())
    // Attribution still moves to report-b (this mount was launched from it) - but nothing is toggled, or
    // the store's symmetric toggle would UNLINK it.
    expect(plan.seedReportId).toBe("report-b")
    expect(plan.linkReportId).toBeUndefined()
    expect(plan.value).toBe(live)
  })
})

describe("applyHostSeedPoint (map long-press 'Host an event here')", () => {
  it("moves the coordinate while KEEPING every typed field", () => {
    const patch = vi.fn()
    const value = typedForm()
    expect(applyHostSeedPoint({ value, patch }, { lat: 37.7749, lng: -122.4194 })).toBe(true)
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith({
      ...value,
      coords: { lat: 37.7749, lng: -122.4194 },
    })
  })

  it("is a NO-OP for an identical point (a re-render / StrictMode double-effect must not churn)", () => {
    const patch = vi.fn()
    expect(applyHostSeedPoint({ value: typedForm(), patch }, { lat: 10, lng: 20 })).toBe(false)
    expect(patch).not.toHaveBeenCalled()
  })

  it("returns false with no draft at all", () => {
    const patch = vi.fn()
    expect(applyHostSeedPoint({ value: null, patch }, { lat: 1, lng: 2 })).toBe(false)
    expect(patch).not.toHaveBeenCalled()
  })

  it("fills a draft that has no point yet", () => {
    const patch = vi.fn()
    const value = typedForm({ coords: null })
    expect(applyHostSeedPoint({ value, patch }, { lat: 1, lng: 2 })).toBe(true)
    expect(patch).toHaveBeenCalledWith({ ...value, coords: { lat: 1, lng: 2 } })
  })
})

/** The report-side symmetry: reset-vs-merge for the live report draft. */
function reportDraft(
  over: Partial<Pick<DraftReport, "media" | "reportTypeId" | "lat" | "lng">> = {},
): Pick<DraftReport, "media" | "reportTypeId" | "lat" | "lng"> {
  return { media: [], reportTypeId: null, lat: null, lng: null, ...over }
}
const oneMedia: Pick<DraftReport, "media"> = {
  media: [{ id: "m1", uri: "x", kind: "image", mime: "image/jpeg" }],
}

describe("planDropPinReportSeed (map long-press 'Report an issue here')", () => {
  it("seeds straight through on an empty draft", () => {
    expect(planDropPinReportSeed(reportDraft(), { lat: 1, lng: 2 })).toBe("seed")
  })

  it("asks before discarding real work at a DIFFERENT spot", () => {
    expect(
      planDropPinReportSeed(reportDraft({ ...oneMedia, lat: 5, lng: 6 }), { lat: 1, lng: 2 }),
    ).toBe("confirm-reset")
    // A chosen category counts as work even with no media yet.
    expect(
      planDropPinReportSeed(reportDraft({ reportTypeId: "pavement", lat: 5, lng: 6 }), { lat: 1, lng: 2 }),
    ).toBe("confirm-reset")
    // Work with NO point at all is still work.
    expect(planDropPinReportSeed(reportDraft({ ...oneMedia }), { lat: 1, lng: 2 })).toBe("confirm-reset")
  })

  it("seeds (no prompt) when the work is already at the SAME spot - a re-press is not a new report", () => {
    expect(
      planDropPinReportSeed(reportDraft({ ...oneMedia, lat: 1, lng: 2 }), { lat: 1, lng: 2 }),
    ).toBe("seed")
  })
})
