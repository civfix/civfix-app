import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { ROSTER_FILTERS, visibleRosterFilters } from "../rosterFiltersModel"
import { requestNextRosterPage, rosterCheckinItems } from "../rosterListModel"
import { SEARCH_DEBOUNCE_MS } from "../../../data/hooks/useDebouncedValue"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const list = code(read("../RosterCheckinList.tsx"))
const block = code(read("../EventRosterBlock.tsx"))
const checkin = code(read("../HostCheckinBody.tsx"))
const checkinRoster = code(["../checkin/CheckinRosterSection.tsx", "../checkin/useCheckinRoster.ts"].map(read).join("\n"))
const listModel = code(read("../rosterListModel.ts"))
const manualEntry = code(read("../checkin/CheckinManualEntry.tsx"))
const paged = code(read("../RosterPagedList.tsx"))
const detail = code(read("../../EventDetailBody.tsx"))
const registration = code(read("../registration/registrationModel.ts"))
const slotsBlock = code(read("../../EventSlotsBlock.tsx"))

const slot = (id: string): EventSlotDTO => ({ id, title: `Slot ${id}`, claimed: 0, sortOrder: 0 })

const signup = (id: string, slotId?: string): EventRegistrationDTO =>
  ({ id, slot: slotId ? { id: slotId, title: `Slot ${slotId}` } : null }) as unknown as EventRegistrationDTO

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
    expect(list).toContain("\nconst RosterCheckinRow")
    expect(paged).toContain("<RosterCheckinList {...list} />")
    expect(block).toContain("<RosterPagedList")
    expect(list.match(/<RosterCheckinRow\b/g) ?? []).toHaveLength(1)
    expect(checkin).toContain('import { useRosterItemRenderer, useRosterListItems } from "./RosterCheckinList"')
    expect(checkin).toContain("const renderRosterItem = useRosterItemRenderer({")
    expect(checkin).toContain("renderItem={renderRosterItem}")
    expect(checkin).toContain("<CheckinRosterSection")
    for (const surface of [block, checkin, checkinRoster, paged]) {
      expect(surface).not.toContain("<RosterCheckinRow")
      expect(surface).not.toContain("<SlotGroupHeader")
    }
    for (const surface of [block, checkin, checkinRoster, paged]) {
      expect(surface).not.toContain("<Avatar")
    }
  })

  it("takes the seat to check in and the seat to undo from the shared pure helpers", () => {
    expect(list).toContain(
      'import { attendeeDisplayName, lastCheckedInSeat, nextCheckinSeat } from "@civfix/shared/host"',
    )
    expect(list).toContain("nextCheckinSeat(row)")
    expect(list).toContain("lastCheckedInSeat(row)")
    expect(list).not.toContain("function nextCheckinSeat")
    for (const surface of [block, checkin, checkinRoster, listModel, paged]) {
      expect(surface).not.toContain("function nextCheckinSeat")
    }
  })
})

describe("both roster surfaces group by slot through the shared model", () => {
  it("reuses groupRosterBySlot rather than bucketing rows again", () => {
    expect(listModel).toContain("groupRosterBySlot(rows, slots, { unassignedTitle })")
    expect(list).toContain('rosterCheckinItems(rows, slots, t("roster.unassigned"))')
    expect(list.match(/<SlotGroupHeader\b/g) ?? []).toHaveLength(1)
    expect(list).toContain("const items = useRosterListItems(rows, slots)")
    expect(list).toContain("items.map((item) => renderItem({ item }))")
    expect(list.match(/key=\{rosterListKey\(item\)\}/g) ?? []).toHaveLength(2)
    expect(checkin).toContain("keyExtractor={rosterListKey}")
    for (const surface of [block, checkin, checkinRoster, paged, list]) {
      expect(surface).not.toContain("groupRosterBySlot")
    }
  })

  it("omits the empty-slot title, because a paged and filtered roster cannot call a slot empty", () => {
    for (const src of [list, listModel]) expect(src).not.toContain("emptySlotTitle")
    expect(list).toContain('if (item.kind === "slot-empty") return null')
    const items = rosterCheckinItems([signup("r1", "s1")], [slot("s1"), slot("s2")], "No slot")
    expect(items.map((item) => item.kind)).toEqual(["slot-header", "member"])
  })

  it("falls back to a flat list when the event authored no slots at all", () => {
    expect(listModel).toContain("slots.length > 0")
    const rows = [signup("r1", "s1"), signup("r2")]
    expect(rosterCheckinItems(rows, [], "No slot")).toEqual([
      { kind: "member", person: rows[0] },
      { kind: "member", person: rows[1] },
    ])
  })

  it("groups by the event's slots, with the unassigned rows last under the caller's title", () => {
    const rows = [signup("r1"), signup("r2", "s1")]
    const items = rosterCheckinItems(rows, [slot("s1")], "No slot")
    expect(items.map((item) => item.kind)).toEqual(["slot-header", "member", "slot-header", "member"])
    expect(items[2]).toMatchObject({ kind: "slot-header", slotId: null, title: "No slot" })
    expect(items[3]).toEqual({ kind: "member", person: rows[0] })
  })

  it("feeds it the event's own slots and zone, never the device's", () => {
    expect(block).toContain("cleanup.data?.slots ?? NO_SLOTS")
    expect(block).toContain("cleanup.data?.timezone ?? undefined")
    expect(checkin).toContain("useRosterListItems(rosterState.waiting, cleanup.data?.slots ?? NO_SLOTS)")
    expect(checkin).toContain("timeZone: cleanup.data?.timezone ?? undefined,")
    expect(list).toContain("timeZone={timeZone}")
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
    expect(checkinRoster).toContain("useDebouncedValue(rosterSearch, SEARCH_DEBOUNCE_MS)")
    expect(block).toContain("useDebouncedValue(search, SEARCH_DEBOUNCE_MS)")
    expect(SEARCH_DEBOUNCE_MS).toBe(250)
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
    expect(checkin).toContain("<RosterLoadMore paging={rosterState.roster} />")
    expect(paged).toContain("<RosterLoadMore paging={paging} />")
    expect(paged).toContain("if (!hasNextPage) return null")
    expect(paged).toContain("requestNextRosterPage({ fetchNextPage, hasNextPage, isFetchingNextPage })")
    expect(listModel).toContain("if (!paging.hasNextPage || paging.isFetchingNextPage) return")
    expect(listModel).toContain("void paging.fetchNextPage()")
    for (const surface of [block, checkin, checkinRoster, list]) {
      expect(surface).not.toContain("fetchNextPage")
    }
  })

  it("fetches the next page only when one exists and none is already in flight", () => {
    const paging = (hasNextPage: boolean, isFetchingNextPage: boolean) => {
      const fetchNextPage = vi.fn(() => Promise.resolve())
      requestNextRosterPage({ hasNextPage, isFetchingNextPage, fetchNextPage })
      return fetchNextPage
    }
    expect(paging(true, false)).toHaveBeenCalledTimes(1)
    expect(paging(true, true)).not.toHaveBeenCalled()
    expect(paging(false, false)).not.toHaveBeenCalled()
    expect(paging(false, true)).not.toHaveBeenCalled()
  })

  it("lists the check-in roster as the screen's own virtualized rows, never a mapped list in a ScrollView", () => {
    expect(checkin).toContain("const { FlatList } = useScrollHost()")
    expect(checkin).not.toMatch(/\bScrollView\b/)
    expect(checkin).not.toContain("<RosterPagedList")
    expect(checkin).toContain("data={rosterListed ? rosterItems : NO_ROSTER_ITEMS}")
    expect(checkinRoster).not.toContain("<RosterPagedList")
    const imports = listModel.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bFlatList\b|\bScrollView\b/)
  })

  it("mounts no scroller of its own inside the screen's ScrollView", () => {
    for (const src of [list, paged, listModel]) {
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
