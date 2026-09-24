import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ROSTER_FILTERS, visibleRosterFilters } from "../rosterFiltersModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const list = code(read("../RosterCheckinList.tsx"))
const block = code(read("../EventRosterBlock.tsx"))
const checkin = code(read("../HostCheckinBody.tsx"))
const checkinRoster = code(["../checkin/CheckinRosterSection.tsx", "../checkin/useCheckinRoster.ts"].map(read).join("\n"))
const manualEntry = code(read("../checkin/CheckinManualEntry.tsx"))
const paged = code(read("../RosterPagedList.tsx"))
const detail = code(read("../../EventDetailBody.tsx"))
const registration = code(read("../registration/registrationModel.ts"))
const slotsBlock = code(read("../../EventSlotsBlock.tsx"))

describe("visibleRosterFilters", () => {
  it("offers every filter on a ticketed event", () => {
    expect(visibleRosterFilters(true)).toEqual(ROSTER_FILTERS)
  })

  it("drops the waitlist chip on an event with no ticket types, which cannot waitlist", () => {
    expect(visibleRosterFilters(false)).toEqual(["all", "not_checked_in", "checked_in"])
  })

  it("keeps the offered filters a subset of the contract's, in the same order", () => {
    for (const hasTicketTypes of [true, false]) {
      const offered = visibleRosterFilters(hasTicketTypes)
      expect(offered.every((f) => ROSTER_FILTERS.includes(f))).toBe(true)
      expect([...offered]).toEqual(ROSTER_FILTERS.filter((f) => offered.includes(f)))
    }
  })
})

describe("there is ONE check-in row in the package", () => {
  it("lives in RosterCheckinList and is reached from both host surfaces", () => {
    expect(list).toContain("export const RosterCheckinRow")
    expect(paged).toContain("<RosterCheckinList {...list} />")
    expect(block).toContain("<RosterPagedList")
    expect(checkinRoster).toContain("<RosterPagedList")
    expect(checkin).toContain("<CheckinRosterSection")
    for (const surface of [block, checkin, checkinRoster, paged]) {
      expect(surface).not.toContain("<Avatar")
    }
  })

  it("takes the seat to check in and the seat to undo from the shared pure helpers", () => {
    expect(list).toContain("export function nextCheckinSeat")
    expect(list).toContain("export function lastCheckedInSeat")
    for (const surface of [block, checkin, checkinRoster, paged]) {
      expect(surface).not.toContain("function nextCheckinSeat")
    }
  })
})

describe("both roster surfaces group by slot through the shared model", () => {
  it("reuses groupRosterBySlot rather than bucketing rows again", () => {
    expect(list).toContain("groupRosterBySlot(rows, slots,")
    expect(list).toContain("<SlotGroupHeader")
    expect(list).toContain("rosterListKey(item)")
    for (const surface of [block, checkin, checkinRoster, paged]) {
      expect(surface).not.toContain("groupRosterBySlot")
    }
  })

  it("omits the empty-slot title, because a paged and filtered roster cannot call a slot empty", () => {
    expect(list).not.toContain("emptySlotTitle")
    expect(list).toContain('item.kind === "slot-empty"')
  })

  it("falls back to a flat list when the event authored no slots at all", () => {
    expect(list).toContain("slots.length > 0")
  })

  it("feeds it the event's own slots and zone, never the device's", () => {
    expect(block).toContain("cleanup.data?.slots ?? NO_SLOTS")
    expect(block).toContain("cleanup.data?.timezone ?? undefined")
    expect(checkin).toMatch(/<CheckinRosterSection\s+cleanup=\{cleanup\.data\}/)
    expect(checkinRoster).toContain("slots={cleanup.slots}")
    expect(checkinRoster).toContain("cleanup.timezone ?? undefined")
  })
})

describe("the roster block hides what a slot-only event cannot have", () => {
  it("drives the chips off the model instead of the raw contract list", () => {
    expect(block).toContain("visibleRosterFilters((cleanup.data?.ticketTypes.length ?? 0) > 0)")
    expect(block).toContain("{filters.map((value) => (")
    expect(block).not.toContain("ROSTER_FILTERS.map")
  })
})

describe("the check-in screen shows who is still waiting", () => {
  it("asks for the not-checked-in projection with the typed search", () => {
    expect(checkin).toContain("useCheckinRoster(id, canCheckIn, desk.undo)")
    expect(checkinRoster).toContain('filter: "not_checked_in"')
    expect(checkinRoster).toContain("q: rosterQuery")
    expect(checkinRoster).toContain("useDebouncedValue(rosterSearch, ROSTER_SEARCH_DEBOUNCE_MS)")
    expect(paged).toContain("export const ROSTER_SEARCH_DEBOUNCE_MS = 250\n")
    expect(checkinRoster).toContain("enabled: canCheckIn")
  })

  it("keeps the scan and manual-code actions ABOVE the list", () => {
    expect(checkin.indexOf('t("action.scan")')).toBeGreaterThan(-1)
    expect(checkin.indexOf('t("action.scan")')).toBeLessThan(checkin.indexOf("<ManualCodeEntry"))
    expect(checkin.indexOf("<ManualCodeEntry")).toBeLessThan(checkin.indexOf("<CheckinRosterSection"))
    expect(manualEntry).toContain('t("manual.submit")')
    expect(checkinRoster).toContain('t("roster.title")')
  })

  it("covers loading, error and the everyone-is-in empty state", () => {
    expect(checkinRoster).toContain('tRoster("roster.loading")')
    expect(checkinRoster).toContain('tRoster("roster.error")')
    expect(checkinRoster).toContain('title={t("roster.empty_title")}')
    expect(checkinRoster).toContain('body={t("roster.empty_body")}')
  })

  it("pages the list rather than dropping attendees past the first page", () => {
    expect(checkinRoster).toContain("paging={roster}")
    expect(paged).toContain("hasNextPage ?")
    expect(paged).toContain("if (!hasNextPage || isFetchingNextPage) return")
    expect(paged).toContain("void fetchNextPage()")
  })

  it("mounts no scroller of its own inside the screen's ScrollView", () => {
    for (const src of [list, paged]) {
      const imports = src.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
      expect(imports).not.toMatch(/\bFlatList\b/)
      expect(imports).not.toMatch(/\bScrollView\b/)
      expect(imports).not.toMatch(/\bModal\b/)
      expect(src).not.toMatch(/useScrollHost/)
    }
  })
})

describe("a member of a NON-ticketed event can still open their ticket", () => {
  it("offers the row off the registration the backend creates for every signup", () => {
    expect(detail).toContain(
      'useNavStore.getState().push({ kind: "my-ticket", id: cleanup.id, title: cleanup.title })',
    )
    expect(detail).toContain(
      "const holdsSeat = isRegistered && cleanup.myRegistration?.waitlistPosition == null",
    )
    expect(detail).toContain(
      "const showTicket = going && holdsSeat && isLive && (!hasTicketTypes || actsAsHost)",
    )
  })

  it("reuses the registration block's own copy rather than minting a second label", () => {
    expect(detail).toContain('label={t("host-ticket:mine.view_ticket")}')
    expect(code(read("../registration/RegistrationBlock.tsx"))).toContain('t("mine.view_ticket")')
  })

  it("leaves the registration block hidden on an event with no ticket types", () => {
    expect(registration).toContain('if (input.ticketTypes.length === 0) return "hidden"')
  })

  it("leaves a registered viewer inert on the slot board of a non-ticketed event", () => {
    expect(slotsBlock).toContain("const showPill = !ticketed || viewer.registered || viewer.actsAsHost")
    expect(slotsBlock).toContain('const ticketed = mode === "registration"')
    const registeredReads = slotsBlock.match(/viewer\.registered/g) ?? []
    expect(registeredReads).toHaveLength(2)
    expect(slotsBlock).toContain('viewerState === "going_no_slot" && (!ticketed || viewer.registered)')
  })
})
