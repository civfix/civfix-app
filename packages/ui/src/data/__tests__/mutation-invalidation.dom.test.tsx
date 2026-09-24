/// <reference types="vite/client" />
import { act, renderHook, waitFor } from "@testing-library/react"
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  type InvalidateQueryFilters,
} from "@tanstack/react-query"
import type * as TanstackQuery from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi, type RunnerTask } from "vitest"
import type { UserDTO } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { I18nProvider } from "../../i18n"
import { useReportSubmit } from "../../report/submit"
import { useDraftReportStore } from "../../report/draftStore"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import type { DataContextValue } from "../types"
import { useCreateAnnouncement } from "../hooks/announcements"
import {
  useCancelCleanup,
  useClaimEventSlot,
  useCreateCleanup,
  useDuplicateCleanup,
  useGuestRsvpRequest,
  useGuestRsvpVerify,
  useJoinCleanup,
  useRemoveMember,
  useRequestEventResources,
  useSetMemberRole,
  useUpdateCleanup,
} from "../hooks/cleanups"
import { useBlockUser, useStartDm, useUnblockUser } from "../hooks/direct"
import {
  useAddGroupMembers,
  useCreateGroup,
  useJoinGroup,
  useRemoveGroupMember,
  useSetGroupMemberRole,
  useUpdateGroup,
} from "../hooks/groups"
import {
  useAcceptEventTeamInvite,
  useAcceptMyEventInvite,
  useCancelEventRegistration,
  useCheckInEventSeat,
  useDeclineMyEventInvite,
  useInviteEventTeamMember,
  useJoinEventWaitlist,
  useMarkEventNoShows,
  useRegisterForEvent,
  useRevokeEventTeamInvite,
  useScanEventTicket,
  useUndoEventCheckIn,
  useWalkupRegistration,
} from "../hooks/host"
import { useDeleteAccount, useReportContent, useRequestEmailCode, useRequestMyData } from "../hooks/moderation"
import {
  useMarkNotificationsRead,
  useUpdateNotificationPrefs,
  useUpdatePrivacySettings,
} from "../hooks/notifications"
import {
  useAcceptMyOrgInvite,
  useDeclineMyOrgInvite,
  useInviteOrganizationMember,
  useRemoveOrganizationMember,
  useRevokeOrganizationInvite,
  useSetOrganizationMemberRole,
  useUpdateOrganization,
} from "../hooks/orgs"
import { useCreatePost, useDeletePost, useLikePost, useRepost, useSavePost } from "../hooks/posts"
import {
  useHideConversation,
  useJoinReportChat,
  useLeaveReportChat,
  useMarkThreadRead,
  useToggleMute,
} from "../hooks/reportChat"
import { useResolveReport, useUnlistReport } from "../hooks/reports"
import { useReverseLabel } from "../hooks/reverseLabel"
import { useFollowPerson, useHandleAvailability, useUpdateProfile } from "../hooks/social"
import {
  useIssueServiceHoursCertificate,
  useLogEventHours,
  useRevokeServiceHoursCertificate,
} from "../hooks/volunteer"

// A pass-through spy, so the coverage guard can tell which exported hooks build a mutation.
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackQuery>()
  return { ...actual, useMutation: vi.fn(actual.useMutation) }
})

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
const NOTIFICATION_LISTS: Invalidation[] = [{ predicateMatches: [["notifications", 20]] }]
const MY_EVENT_INVITES: Invalidation[] = [key("event-invites", "mine"), key("hosted-events"), key("notifications")]

function seededClient(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(["cleanup", EVENT], { id: EVENT, joined: false, going: 3 })
  qc.setQueryData(["cleanup", EVENT_ALIAS], { id: EVENT, joined: false, going: 3 })
  qc.setQueryData(["cleanup", OTHER_EVENT], { id: OTHER_EVENT, joined: false, going: 1 })
  qc.setQueryData(["cleanup", EVENT, "attendees"], { attendees: [], going: 3 })
  qc.setQueryData(["notifications", 20], [])
  qc.setQueryData(["notifications", "prefs"], {})
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

function renderWithData<T>(
  useHook: () => T,
  api: Record<string, unknown>,
  overrides: Partial<DataContextValue> = {},
) {
  const queryClient = seededClient()
  const invalidations = recordInvalidations(queryClient)
  const context = {
    ...makeFakeDataContext({ api: api as unknown as ApiClient, auth: { isAuthenticated: true, user: ME } }),
    ...overrides,
  }
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
  overrides: Partial<DataContextValue> = {},
): Promise<Invalidation[]> {
  const { result, invalidations } = renderWithData(useHook, api, overrides)
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
      key("profile", ME.id),
      key("people"),
      key("profile", "me"),
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
      ).toEqual([...HOST_EVENT, key("tickets", "mine", EVENT), ...CLEANUP_LISTS])
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
    ).toEqual([...HOST_EVENT, key("tickets", "mine", EVENT), ...CLEANUP_LISTS])
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

  it("useUpdateCleanup invalidates every cached detail, the calendar file, the cleanup lists and the hosted-event lists", async () => {
    expect(
      await invalidationsOf(() => useUpdateCleanup(), { id: EVENT, patch: { title: "New" } }, {
        updateCleanup: resolves(cleanupDto(EVENT)),
      }),
    ).toEqual([CLEANUP_DETAIL, key("cleanup", EVENT, "ics"), ...CLEANUP_LISTS, ...HOSTED_EVENT_LISTS])
  })

  it("useCancelCleanup invalidates the lists, the hosted-event lists, the roster and the calendar file", async () => {
    expect(
      await invalidationsOf(() => useCancelCleanup(), { id: EVENT }, { cancelCleanup: resolves(cleanupDto(EVENT)) }),
    ).toEqual([...CLEANUP_LISTS, ...HOSTED_EVENT_LISTS, key("cleanup", EVENT, "attendees"), key("cleanup", EVENT, "ics")])
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

  it("useRequestEventResources and useGuestRsvpRequest invalidate nothing", async () => {
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
  })
})

const ORG = "org-1"
const GROUP = "grp-1"
const POST = "post-1"
const ORG_TEAM: Invalidation[] = [key("org-admin", ORG, "members"), key("org-admin", ORG, "invites")]
const MY_ORG_INVITES: Invalidation[] = [key("org-invites", "mine"), key("orgs", "mine"), key("notifications")]
const organizationDto = (slug: string) => ({ id: ORG, slug, name: "Friends of Ballona" })
const postDto = (id: string, viewer: Record<string, boolean> = {}) => ({
  id,
  viewer: { liked: false, saved: false, reposted: false, ...viewer },
  counts: { likes: 0, saves: 0, reposts: 0, replies: 0 },
})
const optimisticPost = { id: "tmp-1", author: { id: ME.id } }

describe("orgs.ts mutation invalidations", () => {
  it("useUpdateOrganization invalidates the old slug's page after a rename, then my organizations", async () => {
    expect(
      await invalidationsOf(() => useUpdateOrganization("old-slug"), { id: ORG } as never, {
        updateOrganization: resolves(organizationDto("new-slug")),
      }),
    ).toEqual([key("org", "old-slug"), key("orgs", "mine")])
  })

  it("useUpdateOrganization invalidates only my organizations when the slug is unchanged", async () => {
    expect(
      await invalidationsOf(() => useUpdateOrganization("same-slug"), { id: ORG } as never, {
        updateOrganization: resolves(organizationDto("same-slug")),
      }),
    ).toEqual([key("orgs", "mine")])
  })

  it.each([
    [
      "useInviteOrganizationMember",
      (orgId: string | undefined) => useInviteOrganizationMember(orgId),
      { identifierKind: "email", identifier: "a@b.co", role: "member" },
      { inviteOrganizationMember: resolves({}) },
    ],
    [
      "useRevokeOrganizationInvite",
      (orgId: string | undefined) => useRevokeOrganizationInvite(orgId),
      { inviteId: "i" },
      { revokeOrganizationInvite: resolves({}) },
    ],
    [
      "useSetOrganizationMemberRole",
      (orgId: string | undefined) => useSetOrganizationMemberRole(orgId),
      { userId: PERSON, role: "admin" },
      { setOrganizationMemberRole: resolves({}) },
    ],
  ] as const)("%s invalidates the org's members and invites, and nothing without an org id", async (_name, useHook, vars, api) => {
    const run = (orgId: string | undefined) =>
      invalidationsOf(() => useHook(orgId) as unknown as Mutating<unknown>, vars, api)
    expect(await run(ORG)).toEqual(ORG_TEAM)
    expect(await run(undefined)).toEqual([])
  })

  it("useRemoveOrganizationMember invalidates the org's members and invites, then my organizations", async () => {
    expect(
      await invalidationsOf(() => useRemoveOrganizationMember(ORG), { userId: PERSON }, {
        removeOrganizationMember: resolves({}),
      }),
    ).toEqual([...ORG_TEAM, key("orgs", "mine")])
  })

  it("useAcceptMyOrgInvite invalidates my org invites, my organizations, notifications and the joined org", async () => {
    expect(
      await invalidationsOf(() => useAcceptMyOrgInvite(), { inviteId: "i" }, {
        acceptMyOrgInvite: resolves({ organization: organizationDto("joined-org") }),
      }),
    ).toEqual([...MY_ORG_INVITES, key("org", "joined-org")])
  })

  it("useDeclineMyOrgInvite invalidates my org invites, my organizations and notifications", async () => {
    expect(
      await invalidationsOf(() => useDeclineMyOrgInvite(), { inviteId: "i" }, { declineMyOrgInvite: resolves({}) }),
    ).toEqual(MY_ORG_INVITES)
  })
})

describe("groups.ts mutation invalidations", () => {
  it("useCreateGroup and useUpdateGroup seed the group info and invalidate only the threads", async () => {
    const group = { id: GROUP, name: "Block club" }
    const created = renderWithData(() => useCreateGroup(), { createChatGroup: resolves(group) })
    await act(async () => {
      await created.result.current.mutateAsync({ name: "Block club" } as never)
    })
    expect(created.invalidations).toEqual([key("threads")])
    expect(created.queryClient.getQueryData(["group", GROUP])).toEqual(group)

    expect(
      await invalidationsOf(() => useUpdateGroup(), { id: GROUP, name: "Renamed" } as never, {
        updateChatGroup: resolves({ ...group, name: "Renamed" }),
      }),
    ).toEqual([key("threads")])
  })

  it("useJoinGroup invalidates the group's members and the threads, not the group info it seeds", async () => {
    expect(
      await invalidationsOf(() => useJoinGroup(), GROUP, { joinChatGroup: resolves({ id: GROUP, myRole: "member" }) }),
    ).toEqual([key("group", GROUP, "members"), key("threads")])
  })

  it("useAddGroupMembers and useRemoveGroupMember invalidate the whole group prefix and the threads", async () => {
    expect(
      await invalidationsOf(() => useAddGroupMembers(), { id: GROUP, userIds: [PERSON] } as never, {
        addGroupMembers: resolves({ members: [] }),
      }),
    ).toEqual([key("group", GROUP), key("threads")])
    expect(
      await invalidationsOf(() => useRemoveGroupMember(), { id: GROUP, userId: PERSON }, {
        removeGroupMember: resolves({ ok: true }),
      }),
    ).toEqual([key("group", GROUP), key("threads")])
  })

  it("useSetGroupMemberRole invalidates the whole group prefix only", async () => {
    expect(
      await invalidationsOf(() => useSetGroupMemberRole(), { id: GROUP, userId: PERSON, role: "admin" }, {
        setGroupMemberRole: resolves({}),
      }),
    ).toEqual([key("group", GROUP)])
  })
})

describe("reportChat.ts mutation invalidations", () => {
  it("useJoinReportChat and useLeaveReportChat invalidate the report and the threads", async () => {
    expect(await invalidationsOf(() => useJoinReportChat(), REPORT, { joinReportChat: resolves({}) })).toEqual([
      key("report", REPORT),
      key("threads"),
    ])
    expect(await invalidationsOf(() => useLeaveReportChat(), REPORT, { leaveReportChat: resolves({}) })).toEqual([
      key("report", REPORT),
      key("threads"),
    ])
  })

  it("useToggleMute, useHideConversation and useMarkThreadRead invalidate the threads", async () => {
    expect(
      await invalidationsOf(() => useToggleMute(), { roomKind: "report", roomId: REPORT, muted: true }, {
        toggleConversationMute: resolves({}),
      }),
    ).toEqual([key("threads")])
    expect(
      await invalidationsOf(() => useHideConversation(), { roomKind: "report", roomId: REPORT, hidden: true }, {
        toggleConversationHidden: resolves({}),
      }),
    ).toEqual([key("threads")])
    expect(
      await invalidationsOf(() => useMarkThreadRead(), { roomKind: "report", roomId: REPORT }, {
        markThreadRead: resolves({}),
      }),
    ).toEqual([key("threads")])
  })
})

describe("posts.ts mutation invalidations", () => {
  it("useLikePost and useRepost invalidate only the post detail", async () => {
    expect(await invalidationsOf(() => useLikePost(POST), false, { likePost: resolves(postDto(POST, { liked: true })) })).toEqual(
      [key("post", POST)],
    )
    expect(
      await invalidationsOf(() => useRepost(POST), false, { repostPost: resolves(postDto(POST, { reposted: true })) }),
    ).toEqual([key("post", POST)])
  })

  it("useRepost invalidates every post list before the detail when the server answers for another post", async () => {
    expect(
      await invalidationsOf(() => useRepost(POST), true, { unrepostPost: resolves(postDto("post-original")) }),
    ).toEqual([key("posts"), key("post", POST)])
  })

  it("useSavePost invalidates the post detail and the saves list", async () => {
    expect(
      await invalidationsOf(() => useSavePost(POST), false, { savePost: resolves(postDto(POST, { saved: true })) }),
    ).toEqual([key("post", POST), key("posts", "saves")])
  })

  it("useCreatePost invalidates the all-posts feed and the author's posts, plus the events feed for an event post", async () => {
    const api = { createPost: resolves(postDto("post-new")) }
    expect(
      await invalidationsOf(() => useCreatePost(), { input: { kind: "post", body: "b" }, optimistic: optimisticPost } as never, api),
    ).toEqual([key("posts", "feed", "all"), key("posts", "user", ME.id)])
    expect(
      await invalidationsOf(
        () => useCreatePost(),
        { input: { kind: "post", body: "b", eventId: EVENT }, optimistic: optimisticPost } as never,
        api,
      ),
    ).toEqual([key("posts", "feed", "all"), key("posts", "feed", "events"), key("posts", "user", ME.id)])
  })

  it("useCreatePost for a reply also invalidates the thread, the parent and the grandparent's thread", async () => {
    const { result, queryClient, invalidations } = renderWithData(() => useCreatePost(), {
      createPost: resolves(postDto("post-reply")),
    })
    queryClient.setQueryData(["post", POST], { ...postDto(POST), replyToId: "post-root" })

    await act(async () => {
      await result.current.mutateAsync({
        input: { kind: "reply", body: "b", replyToId: POST },
        optimistic: optimisticPost,
      } as never)
    })

    expect(invalidations).toEqual([
      key("posts", "feed", "all"),
      key("posts", "user", ME.id),
      key("posts", "replies", POST),
      key("post", POST),
      key("posts", "replies", "post-root"),
    ])
  })

  it("useDeletePost invalidates every post list", async () => {
    expect(await invalidationsOf(() => useDeletePost(), POST, { deletePost: resolves({ ok: true }) })).toEqual([
      key("posts"),
    ])
  })
})

describe("moderation.ts mutation invalidations", () => {
  it("useReportContent, useRequestEmailCode and useRequestMyData invalidate nothing", async () => {
    expect(
      await invalidationsOf(() => useReportContent(), { subjectType: "post", subjectId: POST, reason: "spam" } as never, {
        reportContent: resolves({ ok: true }),
      }),
    ).toEqual([])
    expect(
      await invalidationsOf(() => useRequestEmailCode(), { email: "a@b.co" }, { otpRequest: resolves({}) }),
    ).toEqual([])
    expect(
      await invalidationsOf(() => useRequestMyData(), undefined, { requestDataExport: resolves({ ok: true }) }),
    ).toEqual([])
  })

  it("useDeleteAccount invalidates nothing and hands cache teardown to the host logout", async () => {
    const logout = vi.fn()
    expect(
      await invalidationsOf(() => useDeleteAccount(), { emailOtp: "123456" }, { deleteAccount: resolves({ ok: true }) }, {
        logout,
      }),
    ).toEqual([])
    expect(logout).toHaveBeenCalledTimes(1)
  })
})

describe("direct.ts mutation invalidations", () => {
  it("useStartDm opens the DM behind the auth gate, invalidates the threads and resolves the room", async () => {
    const onResolved = vi.fn()
    const { result, invalidations } = renderWithData(() => useStartDm(), {
      openDm: resolves({ thread: { id: "thread-1", refId: "dm-1" } }),
    })

    act(() => {
      result.current.start({ id: PERSON }, "/people/u-2", { onResolved })
    })

    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(onResolved.mock.calls[0]?.[0]).toMatchObject({ roomId: "dm-1", target: { id: PERSON } })
    expect(invalidations).toEqual([key("threads")])
  })

  it("useBlockUser and useUnblockUser invalidate the threads, the block list and every profile", async () => {
    expect(await invalidationsOf(() => useBlockUser(), PERSON, { blockUser: resolves({ ok: true }) })).toEqual([
      key("threads"),
      key("blocks"),
      key("profile"),
    ])
    expect(await invalidationsOf(() => useUnblockUser(), PERSON, { unblockUser: resolves({ ok: true }) })).toEqual([
      key("blocks"),
      key("threads"),
      key("profile"),
    ])
  })
})

describe("notifications.ts mutation invalidations", () => {
  it("useMarkNotificationsRead invalidates the notification lists but not the prefs", async () => {
    expect(
      await invalidationsOf(() => useMarkNotificationsRead(), ["n-1"], { markNotificationsRead: resolves({ ok: true }) }),
    ).toEqual(NOTIFICATION_LISTS)
  })

  it("currently invalidates the notification lists even when no id was marked", async () => {
    const api = { markNotificationsRead: vi.fn() }
    expect(await invalidationsOf(() => useMarkNotificationsRead(), [], api)).toEqual(NOTIFICATION_LISTS)
    expect(api.markNotificationsRead).not.toHaveBeenCalled()
  })

  it("useUpdateNotificationPrefs reconciles in place and invalidates nothing", async () => {
    expect(
      await invalidationsOf(() => useUpdateNotificationPrefs(), { chat: false } as never, {
        updateNotificationPrefs: resolves({ chat: false }),
      }),
    ).toEqual([])
  })

  it("useUpdatePrivacySettings invalidates my profile, my profile by id and by handle, then the session", async () => {
    expect(
      await invalidationsOf(() => useUpdatePrivacySettings(), true, {
        updateSettings: resolves({ user: { id: ME.id, handle: "mia" } }),
      }),
    ).toEqual([key("profile", "me"), key("profile", ME.id), key("profile", "mia"), key("session")])
  })

  it("useUpdatePrivacySettings also invalidates every post when the primary organization changes", async () => {
    expect(
      await invalidationsOf(() => useUpdatePrivacySettings(), { primaryOrganizationId: ORG }, {
        updateSettings: resolves({ user: { id: ME.id, handle: null } }),
      }),
    ).toEqual([key("profile", "me"), key("profile", ME.id), key("posts"), key("post"), key("session")])
  })
})

describe("volunteer.ts mutation invalidations", () => {
  it("useLogEventHours invalidates my hours, the leaderboards, the event and everything that sums its hours", async () => {
    expect(
      await invalidationsOf(() => useLogEventHours(), { id: EVENT, entries: [] }, { logEventHours: resolves({}) }),
    ).toEqual([
      key("volunteer", "me"),
      key("volunteer", "me", "entries"),
      key("volunteer", "leaderboard"),
      CLEANUP_DETAIL,
      key("volunteer", "event", EVENT),
      key("host", EVENT, "insights"),
      key("hosted-events"),
      key("org"),
    ])
  })

  it("useIssueServiceHoursCertificate and useRevokeServiceHoursCertificate invalidate my certificates", async () => {
    expect(
      await invalidationsOf(() => useIssueServiceHoursCertificate(), { locale: "en" } as never, {
        issueServiceHoursCertificate: resolves({}),
      }),
    ).toEqual([key("certificates", "mine")])
    expect(
      await invalidationsOf(() => useRevokeServiceHoursCertificate(), { code: "CODE" } as never, {
        revokeServiceHoursCertificate: resolves({}),
      }),
    ).toEqual([key("certificates", "mine")])
  })
})

describe("announcements.ts mutation invalidations", () => {
  it("useCreateAnnouncement seeds the new announcement and invalidates the event's announcements", async () => {
    const { result, queryClient, invalidations } = renderWithData(() => useCreateAnnouncement(EVENT), {
      createEventAnnouncement: resolves({ id: "ann-1" }),
    })

    await act(async () => {
      await result.current.mutateAsync({ title: null, bodyMd: "b", audience: { kind: "all" } as never })
    })

    expect(invalidations).toEqual([key("host", EVENT, "announcements")])
    expect(queryClient.getQueryData(["host", EVENT, "announcements", "one", "ann-1"])).toEqual({ id: "ann-1" })
  })
})

describe("report/submit.ts invalidations", () => {
  beforeEach(() => {
    useDraftReportStore.getState().reset()
  })

  it("invalidates the map report pins and my reports", async () => {
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

    expect(invalidations).toEqual([key("map", "reports"), key("reports", "mine")])
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
    const checkHandle = vi.fn(async (_req: { handle: string }, _opts?: { signal?: AbortSignal }) => ({
      available: true,
    }))
    const { result, queryClient } = renderWithData(() => useHandleAvailability("Maya_1", null), { checkHandle })

    await waitFor(() => expect(result.current.data).toEqual({ available: true }))
    expect(checkHandle.mock.calls[0]?.[0]).toEqual({ handle: "Maya_1" })
    expect(checkHandle.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(queryClient.getQueryCache().find({ queryKey: ["handle-available", "Maya_1"], exact: true })).toBeDefined()
  })
})

const HOOK_MODULES = import.meta.glob<Record<string, unknown>>(["../hooks/*.ts", "!../hooks/index.ts", "!../hooks/chat[A-Z]*.ts"], {
  eager: true,
})

// Hooks that cannot render without arguments; the guard needs every export to render so a mutation
// built after an argument dereference is still seen.
const PROBE_ARGS: Record<string, readonly unknown[]> = {
  useAudiencePreview: [EVENT, { kind: "all" }],
  useChat: [EVENT],
  useHandleAvailability: ["", null],
  useHandleAvailabilityCheck: ["", null],
  useMapReports: [{ bbox: null }],
  useMentionSearch: [""],
  useReportSearch: [{}],
  useUserSearch: [""],
}

const PINNING_SUITE = / mutation invalidations$/

function pinningTestNames(task: RunnerTask, inPinningSuite = false): string[] {
  if (task.type !== "suite") return inPinningSuite ? [task.name] : []
  const pinning = inPinningSuite || PINNING_SUITE.test(task.name)
  return task.tasks.flatMap((child) => pinningTestNames(child, pinning))
}

function exportedMutationHooks(): { mutating: string[]; unrenderable: string[] } {
  const mutating: string[] = []
  const unrenderable: string[] = []
  for (const mod of Object.values(HOOK_MODULES)) {
    for (const [name, hook] of Object.entries(mod)) {
      if (!/^use[A-Z]/.test(name) || typeof hook !== "function") continue
      vi.mocked(useMutation).mockClear()
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <I18nProvider locale="en">
            <CapabilitiesProvider value={makeFakeCapabilities()}>
              <ApiProvider value={makeFakeDataContext()}>{children}</ApiProvider>
            </CapabilitiesProvider>
          </I18nProvider>
        </QueryClientProvider>
      )
      try {
        renderHook(() => (hook as (...args: readonly unknown[]) => unknown)(...(PROBE_ARGS[name] ?? [])), {
          wrapper,
        }).unmount()
      } catch {
        unrenderable.push(name)
      }
      if (vi.mocked(useMutation).mock.calls.length > 0) mutating.push(name)
    }
  }
  return { mutating: mutating.sort(), unrenderable }
}

describe("mutation hook coverage", () => {
  it("pins every mutation hook exported from data/hooks, and names no other hook in a pinning test", ({ task }) => {
    const { mutating, unrenderable } = exportedMutationHooks()
    expect(unrenderable).toEqual([])

    const titles = pinningTestNames(task.file)
    const exportedHooks = Object.values(HOOK_MODULES).flatMap((mod) =>
      Object.keys(mod).filter((name) => /^use[A-Z]/.test(name)),
    )
    const pinned = exportedHooks
      .filter((name) => titles.some((title) => new RegExp(`\\b${name}\\b`).test(title)))
      .sort()

    expect(pinned).toEqual(mutating)
  })
})
