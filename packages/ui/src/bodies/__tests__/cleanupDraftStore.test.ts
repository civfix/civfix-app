import { describe, it, expect, beforeEach } from "vitest"
import { useCleanupDraft } from "../cleanupDraftStore"
import { commitHostDraftMount, planHostDraftMount } from "../cleanupDraftExit"
import type { CleanupFormValue } from "../CleanupForm"

// The runtime `emptyCleanupForm` is not imported: ../CleanupForm imports `react-native` (and the
// maplibre-heavy ../map), whose Flow-typed entry (`import typeof`) fails to parse under this package's plain
// vitest/node setup. So this inlines an RN-free factory matching its shape and imports only the erased type.
function mkForm(seedLinkedReportId?: string): CleanupFormValue {
  return {
    organizationId: null,
    title: "",
    description: "",
    eventKind: "cleanup",
    addrQuery: "",
    spot: "",
    address: "",
    addressSource: null,
    addressPointKey: null,
    coords: null,
    date: null,
    time: null,
    endTime: null,
    timezone: "America/Los_Angeles",
    bring: [],
    slots: [],
    linkedReportIds: seedLinkedReportId ? [seedLinkedReportId] : [],
    // "Announce to the feed" defaults ON for a NEW event (emptyCleanupForm), and carries an empty caption.
    shareToFeed: true,
    feedCaption: "",
    coverMediaId: null,
    coverPreviewUrl: null,
  }
}

beforeEach(() => useCleanupDraft.getState().clear())

describe("cleanupDraftStore", () => {
  it("begins a fresh draft and marks it active", () => {
    expect(useCleanupDraft.getState().active).toBe(false)
    useCleanupDraft.getState().begin(mkForm("r1"))
    const s = useCleanupDraft.getState()
    expect(s.active).toBe(true)
    expect(s.value?.linkedReportIds).toEqual(["r1"])
  })

  it("begin RESUMES (no-op) when a draft is already active", () => {
    useCleanupDraft.getState().begin(mkForm("r1"))
    useCleanupDraft.getState().patch({ ...useCleanupDraft.getState().value!, title: "Cleanup day" })
    // A second begin (e.g. returning to the form) must keep the edited value, not reset it.
    useCleanupDraft.getState().begin(mkForm())
    expect(useCleanupDraft.getState().value?.title).toBe("Cleanup day")
    expect(useCleanupDraft.getState().value?.linkedReportIds).toEqual(["r1"])
  })

  it("toggleLinkedReport adds then removes an id, and isLinked/linkedCount reflect it", () => {
    useCleanupDraft.getState().begin(mkForm())
    useCleanupDraft.getState().toggleLinkedReport("a")
    expect(useCleanupDraft.getState().isLinked("a")).toBe(true)
    expect(useCleanupDraft.getState().linkedCount()).toBe(1)
    useCleanupDraft.getState().toggleLinkedReport("a")
    expect(useCleanupDraft.getState().isLinked("a")).toBe(false)
    expect(useCleanupDraft.getState().linkedCount()).toBe(0)
  })

  it("clear resets active + value", () => {
    useCleanupDraft.getState().begin(mkForm("r1"))
    useCleanupDraft.getState().clear()
    expect(useCleanupDraft.getState().active).toBe(false)
    expect(useCleanupDraft.getState().value).toBeNull()
  })
})

/**
 * The host form's mount step against the REAL store. "Host an event" from report B while a draft started
 * from report A is live must merge into that draft, never clear the title/description/bring list/point the
 * host had already typed.
 *
 * The step is split into a pure `planHostDraftMount` (render) and `commitHostDraftMount` (an effect)
 * because a store write during render crashes every other subscriber of the store. So every case below
 * asserts BOTH halves, and asserts they agree: the
 * plan's `value` is what the form renders before the commit lands, so any drift between it and the store
 * is a one-frame flash of the wrong draft.
 */
describe("the host form's mount step (plan + commit)", () => {
  const draft = () => useCleanupDraft.getState()
  /** Plan against the live store, commit, and assert the rendered value matched what landed. */
  const mount = (seedReportId: string | undefined, draftSeedReportId: string | undefined, initial: CleanupFormValue) => {
    const plan = planHostDraftMount(draft(), seedReportId, draftSeedReportId, initial)
    commitHostDraftMount(draft(), plan)
    expect(draft().value).toEqual(plan.value)
    return plan
  }

  it("begins a fresh draft and reports the mount as fresh", () => {
    const plan = mount("r1", undefined, mkForm("r1"))
    expect(plan.startedFresh).toBe(true)
    expect(plan.seedReportId).toBe("r1")
    expect(draft().value?.linkedReportIds).toEqual(["r1"])
  })

  it("merges a NEW launching report into the live draft, keeping everything typed", () => {
    mount("report-a", undefined, mkForm("report-a"))
    draft().patch({ ...draft().value!, title: "Beach cleanup", description: "Bring gloves" })

    const plan = mount("report-b", "report-a", mkForm("report-b"))

    expect(plan.startedFresh).toBe(false)
    expect(plan.seedReportId).toBe("report-b")
    expect(draft().value?.title).toBe("Beach cleanup")
    expect(draft().value?.description).toBe("Bring gloves")
    expect(draft().value?.linkedReportIds).toEqual(["report-a", "report-b"])
  })

  it("never unlinks a report the host already added from its detail", () => {
    mount("report-a", undefined, mkForm("report-a"))
    // "Add to event" on report B's detail while the form is unmounted.
    draft().toggleLinkedReport("report-b")

    mount("report-b", "report-a", mkForm("report-b"))

    expect(draft().value?.linkedReportIds).toEqual(["report-a", "report-b"])
  })

  it("resumes an unchanged draft for 'Back to your event' (no seed on the entry)", () => {
    mount("report-a", undefined, mkForm("report-a"))
    draft().patch({ ...draft().value!, title: "Beach cleanup" })

    const plan = mount(undefined, "report-a", mkForm())

    expect(plan.startedFresh).toBe(false)
    expect(plan.seedReportId).toBe("report-a")
    expect(draft().value?.title).toBe("Beach cleanup")
    expect(draft().value?.linkedReportIds).toEqual(["report-a"])
  })

  it("is idempotent when the commit runs twice (a StrictMode double-effect)", () => {
    mount("report-a", undefined, mkForm("report-a"))
    draft().patch({ ...draft().value!, title: "Beach cleanup" })

    const plan = planHostDraftMount(draft(), "report-b", "report-a", mkForm("report-b"))
    commitHostDraftMount(draft(), plan)
    commitHostDraftMount(draft(), plan)

    // A second apply must not re-toggle report-b back OFF, nor lose the typed title.
    expect(draft().value?.linkedReportIds).toEqual(["report-a", "report-b"])
    expect(draft().value?.title).toBe("Beach cleanup")
  })
})
