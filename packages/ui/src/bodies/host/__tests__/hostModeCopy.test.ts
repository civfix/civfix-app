import { describe, expect, it } from "vitest"
import type { CleanupDTO } from "@civfix/shared"
import { hostRelativeLine, hostRowSub, hostRowValue, type HostRowCounts } from "../hostModeCopy"
import { hostSurfaceCapabilities } from "../hostSurfaceModel"
import { relativeUntil } from "../hostTime"

const t = (key: string, options?: Record<string, unknown>): string =>
  options ? `${key}${JSON.stringify(options)}` : key

const relative = (date: Date | string | number, now?: Date | number): string =>
  `rel(${String(date)},${String(now)})`

const event = (over: Partial<CleanupDTO> = {}): CleanupDTO =>
  ({
    pageSlug: null,
    referenceCode: "EV-1",
    jurisdictionGeoid: "0644000",
    teamCount: 3,
    ...over,
  }) as unknown as CleanupDTO

const counts = (over: Partial<HostRowCounts> = {}): HostRowCounts => ({
  stillToCheckIn: 0,
  unmarked: 0,
  checkedInSeats: 0,
  linkedReportCount: 0,
  ...over,
})

describe("host surface capabilities", () => {
  it("grants nothing to a viewer with no standing", () => {
    expect(Object.values(hostSurfaceCapabilities(null)).every((value) => !value)).toBe(true)
  })

  it("maps each capability, and lets anyone who manages the event log hours", () => {
    const can = hostSurfaceCapabilities({ myCapabilities: ["manage_event", "manage_team"] })
    expect(can.manageEvent).toBe(true)
    expect(can.logHours).toBe(true)
    expect(can.manageTeam).toBe(true)
    expect(can.checkIn).toBe(false)
    expect(can.broadcast).toBe(false)
  })

  it("keeps a legacy organizer's role-derived capabilities", () => {
    const can = hostSurfaceCapabilities({ myCapabilities: [], myRole: "organizer" })
    expect(can.manageEvent).toBe(true)
    expect(can.viewRoster).toBe(true)
  })
})

describe("host row sub-lines", () => {
  it("shows the page slug, then the reference code, for the share row", () => {
    expect(hostRowSub("share", event({ pageSlug: "park-sweep" }), counts(), t)).toBe("park-sweep")
    expect(hostRowSub("share", event(), counts(), t)).toBe("EV-1")
  })

  it("counts who is still to check in only while someone is", () => {
    expect(hostRowSub("check_in", event(), counts(), t)).toBeUndefined()
    expect(hostRowSub("scan", event(), counts({ stillToCheckIn: 4 }), t)).toBe(
      'row.check_in_sub{"count":4}',
    )
  })

  it("says nobody is checked in rather than logging hours for zero", () => {
    expect(hostRowSub("log_hours", event(), counts(), t)).toBe("row.log_hours_none")
    expect(hostRowSub("log_hours", event(), counts({ checkedInSeats: 2 }), t)).toBe(
      'row.log_hours_sub{"count":2}',
    )
  })

  it("flags a resource request that has no city to go to", () => {
    expect(hostRowSub("resources", event(), counts(), t)).toBeUndefined()
    expect(hostRowSub("resources", event({ jurisdictionGeoid: null }), counts(), t)).toBe(
      "row.resources_no_city",
    )
  })

  it("leaves rows without a sub-line bare", () => {
    expect(hostRowSub("team", event(), counts(), t)).toBeUndefined()
    expect(hostRowSub("cancel", event(), counts(), t)).toBeUndefined()
  })
})

describe("host row values", () => {
  it("prints the team size and the linked report count when there is one", () => {
    expect(hostRowValue("team", event(), counts())).toBe("3")
    expect(hostRowValue("team", event({ teamCount: undefined }), counts())).toBeUndefined()
    expect(hostRowValue("linked_reports", event(), counts())).toBeUndefined()
    expect(hostRowValue("linked_reports", event(), counts({ linkedReportCount: 2 }))).toBe("2")
  })
})

describe("the phase header's relative line", () => {
  const base = { now: 1_000, startsAt: 5_000, endsAt: 9_000, scheduledAt: "2026-09-11T18:00:00Z" }

  it("counts down to the start before the event", () => {
    expect(hostRelativeLine({ ...base, stage: "upcoming" }, t, relative)).toBe(
      'phase.starts{"when":"rel(1000,5000)"}',
    )
  })

  it("counts up from the scheduled start while underway, and from the end afterwards", () => {
    expect(hostRelativeLine({ ...base, stage: "underway" }, t, relative)).toBe(
      'phase.started{"when":"rel(2026-09-11T18:00:00Z,1000)"}',
    )
    expect(hostRelativeLine({ ...base, stage: "wrapping_up" }, t, relative)).toBe(
      'phase.ended_on{"when":"rel(9000,1000)"}',
    )
    expect(hostRelativeLine({ ...base, stage: "past", endsAt: null }, t, relative)).toBe(
      'phase.ended_on{"when":"rel(2026-09-11T18:00:00Z,1000)"}',
    )
  })

  it("says the event was called off once cancelled", () => {
    expect(hostRelativeLine({ ...base, stage: "cancelled" }, t, relative)).toBe("phase.called_off")
  })
})

describe("relativeUntil", () => {
  it("hands relativeAgo the target second so a future instant reads as time left", () => {
    expect(relativeUntil(relative, 5_000, 1_000)).toBe("rel(1000,5000)")
  })
})
