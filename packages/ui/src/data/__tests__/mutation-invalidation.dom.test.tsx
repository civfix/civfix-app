import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, type InvalidateQueryFilters } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserDTO } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { I18nProvider } from "../../i18n"
import { useReportSubmit } from "../../report/submit"
import { useDraftReportStore } from "../../report/draftStore"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import {
  useCancelCleanup,
  useClaimEventSlot,
  useCreateCleanup,
  useDuplicateCleanup,
  useGuestRsvpCancel,
  useGuestRsvpRequest,
  useGuestRsvpVerify,
  useJoinCleanup,
  useRemoveMember,
  useRequestEventResources,
  useSetMemberRole,
  useUpdateCleanup,
} from "../hooks/cleanups"
import {
  useAcceptEventTeamInvite,
  useAcceptMyEventInvite,
  useCancelEventRegistration,
  useCheckInEventSeat,
  useDeclineMyEventInvite,
  useInviteEventTeamMember,
  useJoinEventWaitlist,
  useLeaveEventWaitlist,
  useMarkEventNoShows,
  useQuickBroadcast,
  useRegisterForEvent,
  useRevokeEventTeamInvite,
  useScanEventTicket,
  useUndoEventCheckIn,
  useWalkupRegistration,
} from "../hooks/host"
import { useResolveReport, useUnlistReport } from "../hooks/reports"
import { useReverseLabel } from "../hooks/reverseLabel"
import { useFollowPerson, useHandleAvailability, useUpdateProfile } from "../hooks/social"

const EVENT = "evt-1"
const EVENT_ALIAS = "ref-evt-1"
const OTHER_EVENT = "evt-2"
const REPORT = "rep-1"
const PERSON = "u-2"
const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

type Invalidation = { queryKey: readonly unknown[] } | { predicateMatches: readonly (readonly unknown[])[] }

const key = (...queryKey: unknown[]): Invalidation => ({ queryKey })

// cleanupDetailFilters matches by predicate, so it is pinned by the seeded keys it selects: the id itself,
// a refcode alias whose cached detail carries that id, and never another event or a longer sub-key.
const CLEANUP_DETAIL: Invalidation = { predicateMatches: [["cleanup", EVENT], ["cleanup", EVENT_ALIAS]] }
const HOST_EVENT: Invalidation[] = [key("host", EVENT), key("host", EVENT, "insights"), CLEANUP_DETAIL]
const CLEANUP_LISTS: Invalidation[] = [key("cleanups"), key("org-events")]
const HOSTED_EVENT_LISTS: Invalidation[] = [key("hosted-events"), key("profile")]
const MY_EVENT_INVITES: Invalidation[] = [key("event-invites", "mine"), key("hosted-events"), key("notifications")]

function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(["cleanup", EVENT], { id: EVENT, joined: false, going: 3 })
  qc.setQueryData(["cleanup", EVENT_ALIAS], { id: EVENT, joined: false, going: 3 })
  qc.setQueryData(["cleanup", OTHER_EVENT], { id: OTHER_EVENT, joined: false, going: 1 })
  qc.setQueryData(["cleanup", EVENT, "attendees"], { attendees: [], going: 3 })
  return qc
}

function recordInvalidations(qc: QueryClient): Invalidation[] {
  const recorded: Invalidation[] = []
  const original = qc.invalidateQueries.bind(qc)
  vi.spyOn(qc, "invalidateQueries").mockImplementation((filters?: InvalidateQueryFilters, options?) => {
    const { predicate, ...rest } = filters ?? {}
    recorded.push(
      predicate
        ? { predicateMatches: qc.getQueryCache().findAll({ predicate }).map((q) => q.queryKey) }
        : (rest as Invalidation),
    )
    return original(filters, options)
  })
  return recorded
}

function renderWithData<T>(useHook: () => T, api: Record<string, unknown>) {
  const queryClient = seededClient()
  const invalidations = recordInvalidations(queryClient)
  const context = makeFakeDataContext({ api: api as unknown as ApiClient, auth: { isAuthenticated: true, user: ME } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="en">
        <CapabilitiesProvider value={makeFakeCapabilities()}>
          <ApiProvider value={context}>{children}</ApiProvider>
        </CapabilitiesProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(useHook, { wrapper })
  return { ...hook, queryClient, invalidations }
}

interface Mutating<TVars> {
  mutateAsync: (vars: TVars) => Promise<unknown>
}

async function invalidationsOf<TVars>(
  useHook: () => Mutating<TVars>,
  vars: TVars,
  api: Record<string, unknown>,
): Promise<Invalidation[]> {
  const { result, invalidations } = renderWithData(useHook, api)
  await act(async () => {
    await result.current.mutateAsync(vars)
  })
  return invalidations
}

const resolves = (value: unknown) => vi.fn(async () => value)
const cleanupDto = (id: string) => ({ id, joined: true, going: 4 })

describe("reports.ts mutation invalidations", () => {
  it("useResolveReport invalidates nothing", async () => {
    const api = { resolveReport: resolves({ id: REPORT, status: "resolved" }) }
    expect(await invalidationsOf(() => useResolveReport(REPORT), true, api)).toEqual([])
  })

  it("useUnlistReport invalidates the map report pins", async () => {
    const api = { unlistReport: resolves({ id: REPORT, visibility: "hidden" }) }
    expect(await invalidationsOf(() => useUnlistReport(REPORT), true, api)).toEqual([key("map", "reports")])
  })
})

describe("social.ts mutation invalidations", () => {
  it("useFollowPerson invalidates nothing", async () => {
    const api = { followPerson: resolves({ isFollowing: true, followers: 5 }) }
    expect(await invalidationsOf(() => useFollowPerson(PERSON), false, api)).toEqual([])
  })

  it("useUpdateProfile invalidates my profile, the updated profile and the people lists", async () => {
    const api = { updateProfile: resolves({ user: { id: ME.id } }) }
    expect(await invalidationsOf(() => useUpdateProfile(), { handle: "mia", displayName: "Mia Me" }, api)).toEqual([
      key("profile", "me"),
      key("profile", ME.id),
      key("people"),
    ])
  })
})

describe("host.ts mutation invalidations", () => {
  it.each([
    ["useMarkEventNoShows", () => useMarkEventNoShows(EVENT), undefined, { markEventNoShows: resolves({}) }],
    ["useScanEventTicket", () => useScanEventTicket(EVENT), { token: "t" }, { scanEventTicket: resolves({}) }],
    ["useCheckInEventSeat", () => useCheckInEventSeat(EVENT), { seatId: "s" }, { checkInEventSeat: resolves({}) }],
    ["useUndoEventCheckIn", () => useUndoEventCheckIn(EVENT), { seatId: "s" }, { undoEventCheckIn: resolves({}) }],
    [
      "useWalkupRegistration",
      () => useWalkupRegistration(EVENT),
      { name: "Walk Up" },
      { createWalkupRegistration: resolves({}) },
    ],
    [
      "useJoinEventWaitlist",
      () => useJoinEventWaitlist(EVENT),
      { ticketTypeId: "tt" },
      { joinEventWaitlist: resolves({ entry: {} }) },
    ],
    ["useLeaveEventWaitlist", () => useLeaveEventWaitlist(EVENT), {}, { leaveEventWaitlist: resolves({}) }],
  ] as const)("%s invalidates the host event, its insights and every cached detail of it", async (_name, useHook, vars, api) => {
    expect(await invalidationsOf(useHook as () => Mutating<unknown>, vars, api)).toEqual(HOST_EVENT)
  })

  it("useInviteEventTeamMember and useRevokeEventTeamInvite invalidate the team, then the host event", async () => {
    expect(
      await invalidationsOf(
        () => useInviteEventTeamMember(EVENT),
        { identifier: "a@b.co", identifierKind: "email", role: "cohost" } as never,
        { inviteEventTeamMember: resolves({}) },
      ),
    ).toEqual([key("host", EVENT, "team"), ...HOST_EVENT])
    expect(
      await invalidationsOf(() => useRevokeEventTeamInvite(EVENT), { inviteId: "i" }, {
        revokeEventTeamInvite: resolves({}),
      }),
    ).toEqual([key("host", EVENT, "team"), ...HOST_EVENT])
  })

  it("useAcceptEventTeamInvite invalidates the team, my invites and the host event", async () => {
    expect(
      await invalidationsOf(() => useAcceptEventTeamInvite(EVENT), { token: "t" }, {
        acceptEventTeamInvite: resolves({}),
      }),
    ).toEqual([key("host", EVENT, "team"), ...MY_EVENT_INVITES, ...HOST_EVENT])
  })

  it.each(["registered", "waitlisted", "replayed"] as const)(
    "useRegisterForEvent invalidates the host event, my ticket and the cleanup lists when %s",
    async (outcome) => {
      expect(
        await invalidationsOf(() => useRegisterForEvent(EVENT), { idempotencyKey: "idem-key-1" } as never, {
          registerForEvent: resolves({ outcome, registration: null, ticketTokens: [] }),
        }),
      ).toEqual([...HOST_EVENT, key("tickets", "mine", EVENT), key("cleanups")])
    },
  )

  it("useRegisterForEvent invalidates nothing for a refused registration", async () => {
    expect(
      await invalidationsOf(() => useRegisterForEvent(EVENT), { idempotencyKey: "idem-key-1" } as never, {
        registerForEvent: resolves({ outcome: "full", registration: null, ticketTokens: [] }),
      }),
    ).toEqual([])
  })

  it("useCancelEventRegistration invalidates the host event, my ticket and the cleanup lists", async () => {
    expect(
      await invalidationsOf(() => useCancelEventRegistration(EVENT), { registrationId: "r" }, {
        cancelEventRegistration: resolves({}),
      }),
    ).toEqual([...HOST_EVENT, key("tickets", "mine", EVENT), key("cleanups")])
  })

  it("useAcceptMyEventInvite invalidates my invites and the accepted event", async () => {
    expect(
      await invalidationsOf(() => useAcceptMyEventInvite(), { inviteId: "i" }, {
        acceptMyEventInvite: resolves({ event: { id: EVENT } }),
      }),
    ).toEqual([...MY_EVENT_INVITES, ...HOST_EVENT])
  })

  it("useDeclineMyEventInvite invalidates my invites", async () => {
    expect(
      await invalidationsOf(() => useDeclineMyEventInvite(), { inviteId: "i" }, {
        declineMyEventInvite: resolves({}),
      }),
    ).toEqual(MY_EVENT_INVITES)
  })

  it("useQuickBroadcast invalidates the host event after a send and after a discard", async () => {
    const api = {
      createEventBroadcast: resolves({ id: "b-1" }),
      sendEventBroadcast: resolves({ id: "b-1", status: "sending" }),
    }
    const { result, invalidations } = renderWithData(() => useQuickBroadcast(EVENT), api)

    await act(async () => {
      await result.current.mutateAsync({ subject: "s", bodyMd: "b", segment: { kind: "all" } as never })
    })
    expect(invalidations).toEqual(HOST_EVENT)

    await act(async () => {
      await result.current.discard.mutateAsync()
    })
    expect(invalidations).toEqual([...HOST_EVENT, ...HOST_EVENT])
  })
})

describe("cleanups.ts mutation invalidations", () => {
  it("useJoinCleanup invalidates every cached detail, the cleanup lists and the roster once settled", async () => {
    expect(
      await invalidationsOf(() => useJoinCleanup(EVENT), false, { joinCleanup: resolves({ joined: true, going: 4 }) }),
    ).toEqual([CLEANUP_DETAIL, ...CLEANUP_LISTS, key("cleanup", EVENT, "attendees")])
  })

  it("useCreateCleanup and useDuplicateCleanup invalidate the cleanup and hosted-event lists", async () => {
    const expected = [...CLEANUP_LISTS, ...HOSTED_EVENT_LISTS]
    expect(
      await invalidationsOf(() => useCreateCleanup(), { title: "t" } as never, {
        createCleanup: resolves(cleanupDto("evt-new")),
      }),
    ).toEqual(expected)
    expect(
      await invalidationsOf(() => useDuplicateCleanup(), { id: EVENT } as never, {
        duplicateCleanup: resolves(cleanupDto("evt-copy")),
      }),
    ).toEqual(expected)
  })

  it("useUpdateCleanup invalidates every cached detail, the cleanup lists and the hosted-event lists", async () => {
    expect(
      await invalidationsOf(() => useUpdateCleanup(), { id: EVENT, patch: { title: "New" } }, {
        updateCleanup: resolves(cleanupDto(EVENT)),
      }),
    ).toEqual([CLEANUP_DETAIL, ...CLEANUP_LISTS, ...HOSTED_EVENT_LISTS])
  })

  it("useCancelCleanup invalidates the lists, the hosted-event lists and the roster", async () => {
    expect(
      await invalidationsOf(() => useCancelCleanup(), { id: EVENT }, { cancelCleanup: resolves(cleanupDto(EVENT)) }),
    ).toEqual([...CLEANUP_LISTS, ...HOSTED_EVENT_LISTS, key("cleanup", EVENT, "attendees")])
  })

  it("useClaimEventSlot invalidates the lists, the roster and the event insights", async () => {
    expect(
      await invalidationsOf(() => useClaimEventSlot(EVENT), { slotId: "slot-1" }, {
        claimEventSlot: resolves(cleanupDto(EVENT)),
      }),
    ).toEqual([...CLEANUP_LISTS, key("cleanup", EVENT, "attendees"), key("host", EVENT, "insights")])
  })

  it("useSetMemberRole invalidates the roster and every cached detail", async () => {
    expect(
      await invalidationsOf(() => useSetMemberRole(), { id: EVENT, userId: PERSON, role: "cohost" } as never, {
        setCleanupMemberRole: resolves({}),
      }),
    ).toEqual([key("cleanup", EVENT, "attendees"), CLEANUP_DETAIL])
  })

  it("useRemoveMember invalidates the roster, every cached detail and the lists", async () => {
    expect(
      await invalidationsOf(() => useRemoveMember(), { id: EVENT, userId: PERSON }, {
        removeCleanupMember: resolves({ going: 2 }),
      }),
    ).toEqual([key("cleanup", EVENT, "attendees"), CLEANUP_DETAIL, ...CLEANUP_LISTS])
  })

  it("useGuestRsvpVerify invalidates every cached detail, the lists and the roster", async () => {
    expect(
      await invalidationsOf(() => useGuestRsvpVerify(EVENT), { code: "123456" } as never, {
        guestRsvpVerify: resolves({ going: 4 }),
      }),
    ).toEqual([CLEANUP_DETAIL, ...CLEANUP_LISTS, key("cleanup", EVENT, "attendees")])
  })

  it("useRequestEventResources, useGuestRsvpRequest and useGuestRsvpCancel invalidate nothing", async () => {
    expect(
      await invalidationsOf(() => useRequestEventResources(EVENT), { message: "m" }, {
        requestEventResources: resolves({}),
      }),
    ).toEqual([])
    expect(
      await invalidationsOf(() => useGuestRsvpRequest(EVENT), { email: "a@b.co" } as never, {
        guestRsvpRequest: resolves({}),
      }),
    ).toEqual([])
    expect(
      await invalidationsOf(() => useGuestRsvpCancel(), { token: "t" }, { guestRsvpCancel: resolves({}) }),
    ).toEqual([])
  })
})

describe("report/submit.ts invalidations", () => {
  beforeEach(() => {
    useDraftReportStore.getState().reset()
  })

  it("currently invalidates the unused mapReports key as well as the map report pins and my reports", async () => {
    const store = useDraftReportStore.getState()
    store.setCategory("graffiti", "Graffiti")
    store.setLocation(34.05, -118.25, "manual")
    store.setMedia({ uri: "file:///a.jpg", kind: "image", mime: "image/jpeg", uploadId: "up-1" })
    const api = {
      myProfile: resolves({ profile: { id: ME.id } }),
      createReport: resolves({ id: REPORT, lat: 34.05, lng: -118.25, category: "graffiti", status: "published" }),
    }
    const { result, invalidations } = renderWithData(() => useReportSubmit(), api)

    await act(async () => {
      await result.current()
    })

    expect(invalidations).toEqual([key("mapReports"), key("map", "reports"), key("reports", "mine")])
  })
})

describe("literal query keys the key consolidation will move into queryKeys", () => {
  it("useReverseLabel keys a point by its 5-decimal rounded coordinates and invalidates nothing", async () => {
    const api = { reverseLabel: resolves({ cityStateLabel: " Los Angeles, CA " }) }
    const { result, queryClient, invalidations } = renderWithData(
      () => useReverseLabel({ lat: 34.0522349, lng: -118.2436851 }),
      api,
    )

    await waitFor(() => expect(result.current.data).toBe("Los Angeles, CA"))
    expect(queryClient.getQueryState(["reverse-label", 34.05223, -118.24369])?.data).toBe("Los Angeles, CA")
    expect(invalidations).toEqual([])
  })

  it("useReverseLabel parks a missing point under a null key without fetching", async () => {
    const api = { reverseLabel: vi.fn() }
    const { queryClient } = renderWithData(() => useReverseLabel(null), api)

    expect(queryClient.getQueryCache().find({ queryKey: ["reverse-label", null, null], exact: true })).toBeDefined()
    expect(api.reverseLabel).not.toHaveBeenCalled()
  })

  it("currently keys handle availability by the handle exactly as typed, case included", async () => {
    const api = { checkHandle: resolves({ available: true }) }
    const { result, queryClient } = renderWithData(() => useHandleAvailability("Maya_1", null), api)

    await waitFor(() => expect(result.current.data).toEqual({ available: true }))
    expect(api.checkHandle).toHaveBeenCalledWith({ handle: "Maya_1" })
    expect(queryClient.getQueryCache().find({ queryKey: ["handle-available", "Maya_1"], exact: true })).toBeDefined()
  })
})
