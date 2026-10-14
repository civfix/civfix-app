"use client"

import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import type {
  GetProfileResponse,
  SearchUsersResponse,
  UserProfileDTO,
  CleanupDTO,
  ReportDTO,
  ListMyReportsResponse,
  ListNotificationsResponse,
  NotificationPrefsDTO,
  MarkReadResponse,
  UpdateSettingsResponse,
  ListThreadsResponse,
  ChatHistoryResponse,
  JurisdictionDTO,
  ReportClusterResponse,
  PostDTO,
} from "@civfix/shared"
import type { CleanupAttendeesResponse } from "@civfix/shared"
import { MS_PER_DAY, MS_PER_MINUTE } from "@civfix/shared"
import type {
  EventHoursResponse,
  EventSlotDTO,
  GetMyHoursResponse,
  IssueServiceHoursCertificateResponse,
  LeaderboardResponse,
  ListMyCertificatesResponse,
  LogEventHoursResponse,
  MyVolunteerHoursEntriesResponse,
  PublicVolunteerHoursResponse,
  RevokeCertificateResponse,
  ServiceHoursCertificateDTO,
  VolunteerHoursEntryDTO,
} from "@civfix/shared"
import {
  ApiProvider,
  makeFakeDataContext,
  SocialBody,
  PersonDetailBody,
  ProfileBody,
  ReportsBody,
  ReportDetailBody,
  FeedBody,
  EventsBody,
  EventDetailBody,
  EventDashboardBody,
  HostModeBody,
  CreateCleanupBody,
  EditCleanupBody,
  NotificationsBody,
  NotificationPrefsBody,
  MessagingListBody,
  ConversationBody,
  ReportFlowBody,
  BodyRouter,
  LeaderboardBody,
  DiscoveryLeaderboard,
  MembersBody,
  ServiceHoursSection,
  ServiceHoursCertificateCard,
} from "@civfix/ui"
import { CapabilitiesProvider, makeFakeCapabilities } from "@civfix/ui/capabilities"
import { useNavStore } from "@civfix/ui/nav"
import { useTheme } from "@civfix/ui/theme"

import { makeQueryClient } from "@/lib/query"
import {
  DASHBOARD_EVENT_ERROR_ID,
  DASHBOARD_EVENT_IDS,
  DASHBOARD_EVENT_PENDING_ID,
  emptyPortfolioOverrides,
  failing,
  makeDashboardFakeApi,
  soloPortfolioOverrides,
  pendingForever,
  portfolioOverrides,
} from "./dashboard-fixtures"
import {
  GALLERY_LEADERBOARD_PODIUM,
  GALLERY_MY_PROFILE,
  GALLERY_NOTIFICATIONS,
  GALLERY_NOTIFICATION_PREFS,
  GALLERY_SEARCH_RESULTS,
  GALLERY_VIEWER,
  daysAgo,
  galleryChatHistory,
  galleryThreads,
  hoursAgo,
  isoFromNow,
  makeCannedApi,
} from "./fixtures"

const ORGANIZER = {
  id: "p-ann",
  name: "Ann Rivera",
  handle: "annrivera",
  bio: null,
  avatar: null,
  avatarUrl: null,
  followers: 128,
  following: 64,
  isFollowing: false,
}

function event(id: string, title: string, daysAgo: number, organizerId: string): CleanupDTO {
  const scheduledAt = isoFromNow(-daysAgo * MS_PER_DAY)
  return {
    id,
    title,
    type: "site",
    eventKind: "cleanup",
    description: null,
    lat: 37.77,
    lng: -122.42,
    scheduledAt,
    status: "done",
    organizer: { ...ORGANIZER, id: organizerId },
    going: 12,
    joined: true,
    bring: [],
    address: "Dolores Park, San Francisco",
    linkedReports: [],
    slots: [],
    dist: null,
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
  } as CleanupDTO
}

const PERSON_PROFILE: UserProfileDTO = {
  id: "p-ann",
  name: "Ann Rivera",
  handle: "annrivera",
  bio: "Park steward and weekend cleanup organizer. Always up for a litter sweep along the creek.",
  avatar: null,
  avatarUrl: null,
  followers: 128,
  following: 64,
  isFollowing: false,
  pastEvents: [
    event("e1", "Creekside litter sweep", 9, "p-ann"),
    event("e2", "Mission mural touch-up", 20, "p-other"),
  ],
  stats: { reports: 7, fixed: 5, cleanups: 4 },
  volunteerHours: 8,
  showVolunteerHours: true,
}

const MY_PROFILE: UserProfileDTO = {
  ...GALLERY_MY_PROFILE,
  pastEvents: [
    event("e3", "24th St planter day", 4, "me"),
    event("e4", "Bayview shoreline cleanup", 14, "p-ann"),
  ],
}

const LINKED_EVENTS = [
  {
    id: "e1",
    title: "Creekside litter sweep",
    eventKind: "cleanup",
    scheduledAt: isoFromNow(2 * MS_PER_DAY),
    lat: 37.77,
    lng: -122.42,
    going: 8,
    organizer: ORGANIZER,
    linkedAt: daysAgo(1),
  },
] as ReportDTO["linkedEvents"]

const PICKER_PINS = [
  { id: "r-pothole", category: "hazard", status: "in_progress", lat: 37.7599, lng: -122.4148 },
  { id: "r-trash", category: "trash", status: "published", lat: 37.761, lng: -122.416 },
  { id: "r-graffiti", category: "graffiti", status: "published", lat: 37.758, lng: -122.413 },
] as ReportClusterResponse["pins"]

function report(
  id: string,
  category: ReportDTO["category"],
  title: string,
  status: ReportDTO["status"],
  opts: Partial<ReportDTO> = {},
): ReportDTO {
  const createdAt = daysAgo(3)
  return {
    id,
    category,
    title,
    description:
      "Reported via civfix. The deep pothole near the crosswalk is a hazard for cyclists and is getting worse after the rain.",
    addr: "2401 Mission St, San Francisco, CA",
    status,
    visibility: "public",
    lat: 37.7599,
    lng: -122.4148,
    geomSource: "manual",
    createdAt,
    publishedAt: status === "submitted" ? null : createdAt,
    mine: true,
    gov: status !== "submitted",
    following: false,
    media: [],
    timeline: [
      { status: "submitted", at: createdAt, note: null },
      ...(status !== "submitted"
        ? [{ status, at: daysAgo(1), note: "City crew assigned to inspect the site." }]
        : []),
    ],
    ...opts,
  } as ReportDTO
}

const MY_REPORTS: ListMyReportsResponse = {
  items: [
    report("r-pothole", "hazard", "Deep pothole on Mission St", "in_progress"),
    report("r-graffiti", "graffiti", "Tagging on the library wall", "submitted"),
    report("r-trash", "trash", "Overflowing bin at the bus stop", "resolved"),
  ],
  nextCursor: null,
}

const REPORT_DETAIL: ReportDTO = report("r-pothole", "hazard", "Deep pothole on Mission St", "in_progress", {
  following: false,
  media: [
    {
      id: "m1",
      kind: "video",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
      status: "ready",
    },
  ] as ReportDTO["media"],
  discussionCount: 3,
  cityHandle: "sfpublicworks",
  cityName: "SF Public Works",
  canForwardToCity: true,
  linkedEvents: LINKED_EVENTS,
})

const NOTIFICATIONS: ListNotificationsResponse = {
  items: [
    ...GALLERY_NOTIFICATIONS,
    {
      id: "n3",
      type: "new_follower",
      title: "Ann Rivera started following you",
      body: null,
      read: true,
      createdAt: daysAgo(3),
      link: "/people/p-ann",
    },
  ],
  nextCursor: null,
}

const NEARBY_CLEANUPS: { items: CleanupDTO[]; nextCursor: string | null } = {
  items: [
    {
      ...event("e1", "Creekside litter sweep", -2, "p-ann"),
      scheduledAt: isoFromNow(2 * MS_PER_DAY),
      status: "upcoming",
      joined: true,
      going: 8,
      dist: 0.4,
    },
    {
      ...event("e2", "Mission mural touch-up", -2, "p-lee"),
      organizer: { ...ORGANIZER, id: "p-lee", name: "Lee Tran", handle: "leetran" },
      scheduledAt: isoFromNow(5 * MS_PER_DAY),
      status: "upcoming",
      joined: false,
      going: 14,
      dist: 2.6,
    },
    {
      ...event("e5", "Dolores Park planting", -2, "p-mei"),
      organizer: { ...ORGANIZER, id: "p-mei", name: "Mei Wong", handle: "meiwong" },
      scheduledAt: isoFromNow(6 * MS_PER_DAY),
      status: "upcoming",
      joined: false,
      going: 5,
      dist: 1.1,
    },
    {
      ...event("e6", "Bayview shoreline sweep", -2, "p-ann"),
      scheduledAt: isoFromNow(8 * MS_PER_DAY),
      status: "upcoming",
      joined: false,
      going: 21,
      dist: 3.4,
    },
  ] as CleanupDTO[],
  nextCursor: null,
}

const ATTENDING_CLEANUPS: { items: CleanupDTO[]; nextCursor: string | null } = {
  items: NEARBY_CLEANUPS.items.filter((c) => c.joined),
  nextCursor: null,
}

const POST_BASE = {
  counts: { likes: 18, reposts: 4, replies: 3, saves: 7 },
  viewer: { liked: false, reposted: false, saved: false },
  media: [],
  mentions: [],
  editedAt: null,
  replyToId: null,
  threadRootId: null,
} satisfies Partial<PostDTO>

const FEED_POSTS: PostDTO[] = [
  {
    ...POST_BASE,
    id: "post-event",
    author: ORGANIZER,
    kind: "post",
    body: "We are meeting by the east gate Saturday morning. Come help us reset the creek path before summer.",
    createdAt: isoFromNow(-35 * MS_PER_MINUTE),
    event: {
      id: "e1",
      title: "Creekside litter sweep",
      eventKind: "cleanup",
      status: "upcoming",
      scheduledAt: NEARBY_CLEANUPS.items[0]!.scheduledAt,
      lat: NEARBY_CLEANUPS.items[0]!.lat,
      lng: NEARBY_CLEANUPS.items[0]!.lng,
      going: 8,
      organizer: ORGANIZER,
      linkedAt: isoFromNow(-35 * MS_PER_MINUTE),
    },
    report: null,
    repostOf: null,
  },
  {
    ...POST_BASE,
    id: "post-fix",
    author: { ...ORGANIZER, id: "p-lee", name: "Lee Tran", handle: "leetran" },
    kind: "post",
    body: "Fix confirmed: the overflowing bin at the Mission stop was cleared this morning.",
    createdAt: hoursAgo(3),
    counts: { likes: 41, reposts: 12, replies: 6, saves: 9 },
    viewer: { liked: true, reposted: false, saved: true },
    event: null,
    report: {
      id: "r-trash",
      category: "trash",
      title: "Overflowing bin at the bus stop",
      status: "resolved",
      lat: 37.761,
      lng: -122.416,
      addr: "24th St & Mission St, San Francisco, CA",
      thumbUrl: null,
      linkedAt: hoursAgo(3),
    },
    repostOf: null,
  },
  {
    ...POST_BASE,
    id: "post-repost",
    author: MY_PROFILE,
    kind: "quote",
    body: "This is what fast neighborhood coordination looks like. Thanks @annrivera and everyone who joined.",
    createdAt: hoursAgo(8),
    mentions: [{ id: "p-ann", handle: "annrivera", displayName: "Ann Rivera" }],
    event: null,
    report: null,
    repostOf: {
      id: "post-event",
      author: ORGANIZER,
      kind: "post",
      media: [],
      excerpt: "We are meeting by the east gate Saturday morning.",
      createdAt: hoursAgo(9),
    },
  },
]

const LINKED_REPORTS = [
  {
    id: "r-pothole",
    category: "hazard",
    title: "Deep pothole on Mission St",
    status: "in_progress",
    lat: 37.7599,
    lng: -122.4148,
    addr: "2401 Mission St, San Francisco, CA",
    thumbUrl: null,
    linkedAt: daysAgo(1),
  },
  {
    id: "r-trash",
    category: "trash",
    title: "Overflowing bin at the bus stop",
    status: "published",
    lat: 37.761,
    lng: -122.416,
    addr: "Mission & 22nd",
    thumbUrl: null,
    linkedAt: hoursAgo(12),
  },
] as CleanupDTO["linkedReports"]

const CLEANUP_DETAIL: CleanupDTO = {
  ...event("e1", "Creekside litter sweep", -2, "p-ann"),
  eventKind: "cleanup",
  description:
    "Join us for a morning sweep along the creek path. We will tackle the litter that washed up after the rain, then grab coffee. Newcomers welcome - tools provided if you do not have your own.",
  scheduledAt: isoFromNow(2 * MS_PER_DAY),
  status: "upcoming",
  joined: false,
  going: 8,
  dist: 0.4,
  bring: ["Work gloves", "Water bottle", "Sturdy shoes"],
  address: "Boathouse dock, Echo Park Lake",
  linkedReports: LINKED_REPORTS,
} as CleanupDTO

const SLOTS: EventSlotDTO[] = [
  {
    id: "s-checkin",
    title: "Check-in table",
    description: "Greet people, hand out bags and mark the roster.",
    capacity: 2,
    claimed: 1,
    sortOrder: 0,
    mine: false,
  },
  { id: "s-sort", title: "Sorting station", description: null, capacity: 2, claimed: 2, sortOrder: 1, mine: false },
  { id: "s-sweep", title: "Sweep crew", description: null, capacity: null, claimed: 5, sortOrder: 2, mine: true },
]

const EDIT_CLEANUP_DETAIL: CleanupDTO = {
  ...event("e-mine", "24th St planter day", -3, "me"),
  eventKind: "cleanup",
  description: "We are refreshing the sidewalk planters along 24th St. Tools and soil provided.",
  scheduledAt: isoFromNow(6 * MS_PER_DAY),
  status: "upcoming",
  joined: false,
  going: 5,
  dist: 0.2,
  bring: ["Gardening gloves", "Trowel"],
  address: "24th St & Folsom, San Francisco",
  linkedReports: LINKED_REPORTS,
  slots: SLOTS.slice(0, 2),
} as CleanupDTO

const SLOT_CLEANUP: CleanupDTO = {
  ...CLEANUP_DETAIL,
  id: "e-slots",
  title: "Echo Park Lake shoreline sweep",
  joined: true,
  going: 11,
  slots: SLOTS,
}

const HOSTED_SLOT_CLEANUP: CleanupDTO = {
  ...EDIT_CLEANUP_DETAIL,
  id: "e-slots-mine",
  going: 11,
  slots: SLOTS,
}

const READY_CLEANUP: CleanupDTO = {
  ...EDIT_CLEANUP_DETAIL,
  id: "e-ready",
  title: "Bayview shoreline cleanup",
  scheduledAt: hoursAgo(3),
  slots: [],
}

const DONE_CLEANUP: CleanupDTO = {
  ...EDIT_CLEANUP_DETAIL,
  id: "e-done",
  status: "done",
  scheduledAt: daysAgo(1),
  slots: [],
}

const DONE_NEW_CLEANUP: CleanupDTO = {
  ...DONE_CLEANUP,
  id: "e-done-new",
  title: "Dolores Park planting day",
}

const DONE_ATTENDED_CLEANUP: CleanupDTO = {
  ...CLEANUP_DETAIL,
  id: "e-done-attended",
  status: "done",
  scheduledAt: daysAgo(2),
  joined: true,
  slots: [],
}

const THREADS = galleryThreads(ORGANIZER)

const CHAT_HISTORY = galleryChatHistory("e1")

const CLEANUP_ATTENDEES: CleanupAttendeesResponse = {
  attendees: [
    {
      ...ORGANIZER,
      id: "p-lee",
      name: "Lee Tran",
      handle: "leetran",
      role: "member",
      slot: { id: "s-checkin", title: "Check-in table" },
    },
    {
      ...ORGANIZER,
      id: "p-mei",
      name: "Mei Wong",
      handle: "meiwong",
      role: "member",
      slot: { id: "s-sweep", title: "Sweep crew" },
    },
  ] as CleanupAttendeesResponse["attendees"],
  going: 8,
  scope: "following",
}

const HOST_ROSTER: CleanupAttendeesResponse = {
  attendees: [
    { ...ORGANIZER, id: "me", name: "Sam Okafor", handle: "samok", role: "organizer" },
    {
      ...ORGANIZER,
      id: "p-lee",
      name: "Lee Tran",
      handle: "leetran",
      role: "cohost",
      slot: { id: "s-checkin", title: "Check-in table" },
    },
    {
      ...ORGANIZER,
      id: "p-mei",
      name: "Mei Wong",
      handle: "meiwong",
      role: "member",
      slot: { id: "s-sweep", title: "Sweep crew" },
    },
    { ...ORGANIZER, id: "p-jae", name: "Jae Park", handle: "jaepark", role: "member", slot: null },
  ] as CleanupAttendeesResponse["attendees"],
  going: 11,
  scope: "all",
}

const HOST_ROSTER_IDS = new Set(["e-mine", "e-slots-mine", "e-ready", "e-done", "e-done-new"])

const CREDITOR = { id: "p-ann", name: "Ann Rivera", handle: "annrivera" }

const MY_HOURS: GetMyHoursResponse = {
  hours: {
    totalHours: 12.5,
    byJurisdiction: [
      { geoid: "0644000", name: "Los Angeles", hours: 10.2 },
      { geoid: "0667000", name: "Santa Monica", hours: 2.3 },
    ],
    byOrganization: [
      {
        organization: {
          id: "org-bayview",
          slug: "bayview-stewards",
          name: "Bayview Stewards",
          logoUrl: null,
          verified: true,
          verifiedKind: "nonprofit",
        },
        hours: 7.5,
      },
      {
        organization: {
          id: "org-mission",
          slug: "mission-green",
          name: "Mission Green",
          logoUrl: null,
          verified: false,
          verifiedKind: null,
        },
        hours: 3.5,
      },
    ],
  },
}

const MY_HOURS_ENTRIES: MyVolunteerHoursEntriesResponse = {
  items: [
    {
      id: "vh-1",
      source: "event",
      hours: 3,
      occurredAt: daysAgo(1),
      creditedAt: hoursAgo(20),
      eventId: "e-done",
      eventTitle: "24th St planter day",
      eventReferenceCode: "CF-24ST-0412",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
      creditedBy: CREDITOR,
    },
    {
      id: "vh-2",
      source: "event",
      hours: 2.5,
      occurredAt: daysAgo(9),
      creditedAt: daysAgo(9),
      eventId: "e1",
      eventTitle: "Creekside litter sweep",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
      creditedBy: CREDITOR,
    },
    {
      id: "vh-3",
      source: "manual",
      hours: 1.5,
      occurredAt: daysAgo(14),
      creditedAt: daysAgo(14),
      jurisdictionGeoid: "0667000",
      jurisdictionName: "Santa Monica",
      creditedBy: null,
    },
    {
      id: "vh-4",
      source: "event",
      hours: 4,
      occurredAt: daysAgo(20),
      creditedAt: daysAgo(20),
      eventId: "e2",
      eventTitle: "Mission mural touch-up",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
      creditedBy: CREDITOR,
    },
    {
      id: "vh-5",
      source: "report",
      hours: 0.1,
      occurredAt: daysAgo(26),
      creditedAt: daysAgo(26),
      reportId: "r-pothole",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
    },
    {
      id: "vh-6",
      source: "event",
      hours: 1.4,
      occurredAt: daysAgo(41),
      creditedAt: daysAgo(41),
      eventId: "e6",
      eventTitle: "Bayview shoreline sweep",
      jurisdictionGeoid: "0667000",
      jurisdictionName: "Santa Monica",
      creditedBy: CREDITOR,
    },
  ] as VolunteerHoursEntryDTO[],
  nextCursor: null,
  totalHours: 12.5,
}

const PUBLIC_HOURS_ENTRIES: PublicVolunteerHoursResponse = {
  visible: true,
  totalHours: 8,
  byJurisdiction: [{ geoid: "0644000", name: "Los Angeles", hours: 8 }],
  byOrganization: [
    {
      organization: {
        id: "org-bayview",
        slug: "bayview-stewards",
        name: "Bayview Stewards",
        logoUrl: null,
        verified: true,
        verifiedKind: "nonprofit",
      },
      hours: 5,
    },
  ],
  items: [
    {
      id: "pvh-1",
      source: "event",
      hours: 3.5,
      occurredAt: daysAgo(9),
      creditedAt: daysAgo(9),
      eventId: "e1",
      eventTitle: "Creekside litter sweep",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
    },
    {
      id: "pvh-2",
      source: "event",
      hours: 2.5,
      occurredAt: daysAgo(20),
      creditedAt: daysAgo(20),
      eventId: "e2",
      eventTitle: "Mission mural touch-up",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
    },
    {
      id: "pvh-3",
      source: "event",
      hours: 1.7,
      occurredAt: daysAgo(33),
      creditedAt: daysAgo(33),
      eventId: "e6",
      eventTitle: "Bayview shoreline sweep",
      jurisdictionGeoid: "0644000",
      jurisdictionName: "Los Angeles",
    },
  ] as VolunteerHoursEntryDTO[],
  reportHours: 0.3,
  nextCursor: null,
}

const LEADERBOARD: LeaderboardResponse = {
  geoid: "0644000",
  jurisdictionName: "Los Angeles",
  entries: [
    ...GALLERY_LEADERBOARD_PODIUM,
    { rank: 4, userId: "p-jae", name: "Jae Park", handle: "jaepark", avatar: null, avatarUrl: null, hours: 30 },
    { rank: 5, userId: "p-ravi", name: "Ravi Shah", handle: "ravishah", avatar: null, avatarUrl: null, hours: 22.5 },
    { rank: 6, userId: "p-nour", name: "Nour Haddad", handle: "nourh", avatar: null, avatarUrl: null, hours: 18 },
  ],
  nextOffset: null,
  participantCount: 42,
  viewerRank: 11,
  viewerHours: 12.5,
}

const CERTIFICATE: ServiceHoursCertificateDTO = {
  code: "7Q2M8H4DXK3V",
  status: "valid",
  locale: "en",
  issuedAt: new Date().toISOString(),
  totalHours: 12.5,
  entryCount: 6,
  periodStart: daysAgo(41),
  periodEnd: hoursAgo(20),
  documentSha256: "9f2b1c0d4e5a678b9c0d1e2f3a4b5c6d7e8f90112233445566778899aabbccdd",
  byteSize: 48213,
  url: "https://example.invalid/civfix-service-record.pdf",
  urlExpiresAt: null,
  revokedAt: null,
}

let CERT_MODE: "fresh" | "expired" = "fresh"

const CLEANUPS_BY_ID: Record<string, CleanupDTO> = {
  "e-mine": EDIT_CLEANUP_DETAIL,
  "e-slots": SLOT_CLEANUP,
  "e-slots-mine": HOSTED_SLOT_CLEANUP,
  "e-ready": READY_CLEANUP,
  "e-done": DONE_CLEANUP,
  "e-done-new": DONE_NEW_CLEANUP,
  "e-done-attended": DONE_ATTENDED_CLEANUP,
}

const DONE_HOURS: EventHoursResponse = {
  scope: "all",
  entries: [
    { userId: "p-lee", hours: 3, loggedAt: hoursAgo(20) },
    { userId: "p-mei", hours: 2.5, loggedAt: hoursAgo(20) },
    { userId: "p-jae", hours: 2.5, loggedAt: hoursAgo(20) },
  ],
  anyLogged: true,
}

const ATTENDED_HOURS: EventHoursResponse = {
  scope: "self",
  entries: [{ userId: "me", hours: 3, loggedAt: daysAgo(1) }],
  anyLogged: true,
}

function slotCleanupWithClaim(base: CleanupDTO, slotId: string | null): CleanupDTO {
  return {
    ...base,
    joined: slotId ? true : base.joined,
    slots: base.slots.map((slot) => ({
      ...slot,
      mine: slot.id === slotId,
      claimed: Math.max(0, slot.claimed + (slot.id === slotId ? 1 : 0) - (slot.mine ? 1 : 0)),
    })),
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const postActionFake = async (args?: { id?: string }) => FEED_POSTS.find((post) => post.id === args?.id) ?? FEED_POSTS[0]!

const chatHistoryFake = async (): Promise<ChatHistoryResponse> => CHAT_HISTORY

const fakeApi: ApiClient = makeCannedApi(
  {
    getProfile: async (): Promise<GetProfileResponse> => ({ profile: PERSON_PROFILE }),
    myProfile: async (): Promise<GetProfileResponse> => ({ profile: MY_PROFILE }),
    searchUsers: async (): Promise<SearchUsersResponse> => GALLERY_SEARCH_RESULTS,
    listMyReports: async (): Promise<ListMyReportsResponse> => MY_REPORTS,
    getReport: async (): Promise<ReportDTO> => REPORT_DETAIL,
    listNotifications: async (): Promise<ListNotificationsResponse> => NOTIFICATIONS,
    markNotificationsRead: async (): Promise<MarkReadResponse> => ({ ok: true }),
    getNotificationPrefs: async (): Promise<NotificationPrefsDTO> => GALLERY_NOTIFICATION_PREFS,
    updateNotificationPrefs: async (): Promise<NotificationPrefsDTO> => GALLERY_NOTIFICATION_PREFS,
    updateSettings: async (): Promise<UpdateSettingsResponse> => ({ user: GALLERY_VIEWER }),
    homeFeed: async (args?: { filter?: string }) => ({
      items: FEED_POSTS.filter((post) => {
        if (args?.filter === "events") return post.event != null
        if (args?.filter === "fixes") return post.report?.status === "resolved"
        return true
      }),
      nextCursor: null,
    }),
    listUserPosts: async (args?: { id?: string }) => ({
      items: FEED_POSTS.filter((post) => !args?.id || post.author.id === args.id),
      nextCursor: null,
    }),
    listSaves: async () => ({ items: FEED_POSTS.filter((post) => post.viewer.saved), nextCursor: null }),
    listReplies: async () => ({ items: [], nextCursor: null }),
    getPost: async (args?: { id?: string }) => FEED_POSTS.find((post) => post.id === args?.id) ?? FEED_POSTS[0]!,
    likePost: postActionFake,
    unlikePost: postActionFake,
    savePost: postActionFake,
    unsavePost: postActionFake,
    repostPost: postActionFake,
    unrepostPost: postActionFake,
    createPost: async (): Promise<PostDTO> => FEED_POSTS[0]!,
    deletePost: async () => ({ ok: true }),
    listCleanups: async (
      args?: { when?: string },
    ): Promise<{ items: CleanupDTO[]; nextCursor: string | null }> =>
      args?.when === "attending" ? ATTENDING_CLEANUPS : NEARBY_CLEANUPS,
    getCleanup: async (args?: { id?: string }): Promise<CleanupDTO> =>
      CLEANUPS_BY_ID[args?.id ?? ""] ?? CLEANUP_DETAIL,
    updateCleanup: async (args: Record<string, unknown>): Promise<CleanupDTO> => ({
      ...EDIT_CLEANUP_DETAIL,
      ...(typeof args.title === "string" ? { title: args.title } : {}),
      ...(typeof args.description === "string" ? { description: args.description } : {}),
    }),
    mapReports: async (): Promise<ReportClusterResponse> => ({ clusters: [], pins: PICKER_PINS }),
    getCleanupAttendees: async (args?: { id?: string }): Promise<CleanupAttendeesResponse> =>
      HOST_ROSTER_IDS.has(args?.id ?? "") ? HOST_ROSTER : CLEANUP_ATTENDEES,
    listThreads: async (): Promise<ListThreadsResponse> => THREADS,
    cleanupMessages: chatHistoryFake,
    dmMessages: chatHistoryFake,
    getMyHours: async (): Promise<GetMyHoursResponse> => MY_HOURS,
    getMyHoursEntries: async (): Promise<MyVolunteerHoursEntriesResponse> => MY_HOURS_ENTRIES,
    getPublicVolunteerHours: async (): Promise<PublicVolunteerHoursResponse> => PUBLIC_HOURS_ENTRIES,
    getJurisdictionLeaderboard: async (): Promise<LeaderboardResponse> => LEADERBOARD,
    getEventHours: async (args?: { id?: string }): Promise<EventHoursResponse> => {
      if (args?.id === "e-done") return DONE_HOURS
      if (args?.id === "e-done-attended") return ATTENDED_HOURS
      return { scope: "self", entries: [], anyLogged: false }
    },
    logEventHours: async (args?: { entries?: unknown[] }): Promise<LogEventHoursResponse> => ({
      credited: args?.entries?.length ?? 0,
    }),
    claimEventSlot: async (args?: { id?: string; slotId?: string | null }): Promise<CleanupDTO> => {
      const id = args?.id ?? ""
      const next = slotCleanupWithClaim(CLEANUPS_BY_ID[id] ?? SLOT_CLEANUP, args?.slotId ?? null)
      if (id) CLEANUPS_BY_ID[id] = next
      return next
    },
    issueServiceHoursCertificate: async (): Promise<IssueServiceHoursCertificateResponse> => {
      await sleep(700)
      return {
        certificate: {
          ...CERTIFICATE,
          issuedAt: new Date().toISOString(),
          urlExpiresAt: new Date(
            Date.now() + (CERT_MODE === "expired" ? -60_000 : 15 * 60_000),
          ).toISOString(),
        },
        reused: false,
      }
    },
    listMyServiceHoursCertificates: async (): Promise<ListMyCertificatesResponse> => ({ certificates: [] }),
    revokeServiceHoursCertificate: async (args?: { code?: string }): Promise<RevokeCertificateResponse> => ({
      certificate: {
        ...CERTIFICATE,
        code: args?.code ?? CERTIFICATE.code,
        status: "revoked",
        url: null,
        urlExpiresAt: null,
        revokedAt: new Date().toISOString(),
      },
    }),
    resolveJurisdiction: async (): Promise<JurisdictionDTO> => ({
      geoid: "0644000",
      name: "Los Angeles Bureau of Sanitation",
      layer: "place",
      cityStateLabel: "Los Angeles, CA",
      routable: true,
    }),
  },
  (name) => (..._args: unknown[]): Promise<never> =>
    Promise.reject(new Error(`bodies-gallery fake api: "${name}" not stubbed`)),
)

const fakeData = makeFakeDataContext({
  api: fakeApi,
  auth: { isAuthenticated: true, user: GALLERY_VIEWER, isPending: false },
})

const fakeCaps = makeFakeCapabilities()

const DASHBOARD_AUTH = { isAuthenticated: true, user: GALLERY_VIEWER, isPending: false }

const dashboardData = makeFakeDataContext({
  api: makeDashboardFakeApi(),
  auth: DASHBOARD_AUTH,
})

const dashboardSoloData = makeFakeDataContext({
  api: makeDashboardFakeApi(soloPortfolioOverrides()),
  auth: DASHBOARD_AUTH,
})

const dashboardEmptyData = makeFakeDataContext({
  api: makeDashboardFakeApi(emptyPortfolioOverrides()),
  auth: DASHBOARD_AUTH,
})

const dashboardPendingData = makeFakeDataContext({
  api: makeDashboardFakeApi(portfolioOverrides(() => pendingForever())),
  auth: DASHBOARD_AUTH,
})

const dashboardErrorData = makeFakeDataContext({
  api: makeDashboardFakeApi(portfolioOverrides((name) => failing(name))),
  auth: DASHBOARD_AUTH,
})

function BodyFrame({
  title,
  height = 620,
  wide = false,
  children,
}: {
  title: string
  height?: number
  wide?: boolean
  children: React.ReactNode
}) {
  const theme = useTheme()
  return (
    <section
      data-body={title}
      style={{
        backgroundColor: theme.colors.bg,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.colors.border}`,
        overflow: "hidden",
        marginTop: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        ...(wide
          ? {
              position: "relative" as const,
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(1180px, calc(100vw - 32px))",
            }
          : null),
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${theme.colors.border}`,
          font: "600 12px/1.2 system-ui, sans-serif",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: theme.colors.textSubtle,
          backgroundColor: theme.colors.surface,
        }}
      >
        {title}
      </div>
      <div style={{ height, display: "flex", flexDirection: "column" }}>{children}</div>
    </section>
  )
}

function DashboardFrame({
  title,
  data = dashboardData,
  height = 720,
  wide = false,
  children,
}: {
  title: string
  data?: React.ComponentProps<typeof ApiProvider>["value"]
  height?: number
  wide?: boolean
  children: React.ReactNode
}) {
  const [client] = React.useState(() => makeQueryClient())
  return (
    <BodyFrame title={title} height={height} wide={wide}>
      <QueryClientProvider client={client}>
        <ApiProvider value={data}>{children}</ApiProvider>
      </QueryClientProvider>
    </BodyFrame>
  )
}

function CertificateHarness() {
  const theme = useTheme()
  const [mode, setMode] = React.useState<"fresh" | "expired">("fresh")
  const [nonce, setNonce] = React.useState(0)
  const select = (next: "fresh" | "expired") => {
    CERT_MODE = next
    setMode(next)
    setNonce((n) => n + 1)
  }
  const btn = (active: boolean): React.CSSProperties => ({
    font: "600 11px/1 system-ui, sans-serif",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    border: `1px solid ${active ? theme.colors.moss["700"] : theme.colors.border}`,
    color: active ? theme.colors.moss["700"] : theme.colors.textSubtle,
    backgroundColor: active ? theme.colors.moss["100"] : theme.colors.surface,
  })
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span style={{ font: "600 11px/1 system-ui, sans-serif", color: theme.colors.textSubtle }}>
          NEXT ISSUE RETURNS
        </span>
        <button type="button" style={btn(mode === "fresh")} onClick={() => select("fresh")}>
          fresh link (ready)
        </button>
        <button type="button" style={btn(mode === "expired")} onClick={() => select("expired")}>
          already-expired link
        </button>
        <button type="button" style={btn(false)} onClick={() => setNonce((n) => n + 1)}>
          reset card
        </button>
      </div>
      <ServiceHoursCertificateCard key={nonce} totalHours={12.5} />
      <div style={{ height: 1, backgroundColor: theme.colors.border, margin: "20px 0" }} />
      <span style={{ font: "600 11px/1 system-ui, sans-serif", color: theme.colors.textSubtle }}>
        totalHours = 0 (the inert disabled pill)
      </span>
      <ServiceHoursCertificateCard totalHours={0} />
    </div>
  )
}

const CAPS_WITHOUT_OPEN_EXTERNAL = (() => {
  const { openExternal: _dropped, ...rest } = makeFakeCapabilities()
  return rest as ReturnType<typeof makeFakeCapabilities>
})()

export default function BodiesGallery() {
  const theme = useTheme()
  const [client] = React.useState(() => makeQueryClient())

  React.useEffect(() => {
    useNavStore.setState({
      query: "@a",
      view: "social",
      mode: "expanded",
      stack: [{ kind: "people" }, { kind: "person", id: "p-ann" }],
    })
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={fakeData}>
        <CapabilitiesProvider value={fakeCaps}>
          <div
            data-gallery="bodies"
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: 16,
              backgroundColor: theme.colors.bgAlt,
              minHeight: "100vh",
            }}
          >
            <h1 style={{ font: "700 20px/1.2 system-ui, sans-serif", color: theme.colors.text, margin: "8px 2px 0" }}>
              Shared bodies
            </h1>
            <p style={{ font: "400 13px/1.4 system-ui, sans-serif", color: theme.colors.textSubtle, margin: "4px 2px 0" }}>
              Shared @civfix/ui bodies rendered via react-native-web against fake data (no backend).
            </p>

            <BodyFrame title="SocialBody (people search)">
              <SocialBody />
            </BodyFrame>

            <BodyFrame title="PersonDetailBody (FULL PAGE: own header, Posts default, Hours tab)" height={760}>
              <PersonDetailBody id="p-ann" />
            </BodyFrame>

            <BodyFrame
              title="PersonDetailBody (DESKTOP WIDTH: the header must show Back only)"
              height={760}
              wide
            >
              <PersonDetailBody id="p-ann" />
            </BodyFrame>

            <BodyFrame title="ProfileBody (own profile: Posts / Events / Hours tabs)" height={760}>
              <ProfileBody />
            </BodyFrame>

            <BodyFrame title="ReportsBody (your reports)">
              <ReportsBody />
            </BodyFrame>

            <BodyFrame title="ReportDetailBody (report / pin detail, video hero)">
              <ReportDetailBody id="r-pothole" />
            </BodyFrame>

            <BodyFrame title="FeedBody (home feed)">
              <FeedBody />
            </BodyFrame>

            <BodyFrame title="EventsBody (events list + host pill)">
              <EventsBody />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (cleanup detail + Reports we'll handle gallery)" height={820}>
              <EventDetailBody id="e1" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (viewer-hosted -> Edit affordance shows)" height={820}>
              <EventDetailBody id="e-mine" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (host, started -> underway, no completion affordance)" height={860}>
              <EventDetailBody id="e-ready" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (signup slots: open / full / mine)" height={860}>
              <EventDetailBody id="e-slots" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (host, DONE, nothing logged -> hours editor)" height={860}>
              <EventDetailBody id="e-done-new" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (host, DONE, hours credited -> summary card + Edit)" height={860}>
              <EventDetailBody id="e-done" />
            </BodyFrame>

            <BodyFrame title="EventDetailBody (attendee, DONE -> credited receipt)" height={820}>
              <EventDetailBody id="e-done-attended" />
            </BodyFrame>

            <BodyFrame title="MembersBody (per-slot roster, host view)" height={560}>
              <MembersBody id="e-slots-mine" roomKind="cleanup" />
            </BodyFrame>

            <BodyFrame title="CreateCleanupBody (host form: kind selector + linked-reports picker)" height={900}>
              <CreateCleanupBody />
            </BodyFrame>

            <BodyFrame title="EditCleanupBody (host edit screen, prefilled)" height={900}>
              <EditCleanupBody id="e-mine" />
            </BodyFrame>

            <BodyFrame title="NotificationsBody (activity inbox)">
              <NotificationsBody />
            </BodyFrame>

            <BodyFrame title="NotificationPrefsBody (notification + privacy prefs)" height={720}>
              <NotificationPrefsBody />
            </BodyFrame>

            <BodyFrame title="MessagingListBody (message inbox)">
              <MessagingListBody />
            </BodyFrame>

            <BodyFrame title="ConversationBody (crew chat - fake history + composer)" height={640}>
              <ConversationBody id="e1" roomKind="cleanup" />
            </BodyFrame>

            <BodyFrame title="ConversationBody (direct message - peer header + composer)" height={640}>
              <ConversationBody id="dm-ann" roomKind="dm" />
            </BodyFrame>

            <BodyFrame title="LeaderboardBody (jurisdiction leaderboard)" height={620}>
              <LeaderboardBody geoid="0644000" />
            </BodyFrame>

            <BodyFrame title="DiscoveryLeaderboard (search page section, isolated)" height={360}>
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <DiscoveryLeaderboard
                  geoid={LEADERBOARD.geoid}
                  name={LEADERBOARD.jurisdictionName ?? null}
                  entries={LEADERBOARD.entries.slice(0, 3)}
                  viewerRank={LEADERBOARD.viewerRank}
                  viewerHours={LEADERBOARD.viewerHours}
                />
              </div>
            </BodyFrame>

            <BodyFrame title="ServiceHoursSection (variant='own': ledger + transcript card)" height={720}>
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <ServiceHoursSection variant="own" totalHours={12.5} />
              </div>
            </BodyFrame>

            <BodyFrame title="ServiceHoursSection (variant='public': another person's ledger)" height={620}>
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <ServiceHoursSection variant="public" userId="p-ann" totalHours={8} />
              </div>
            </BodyFrame>

            <BodyFrame title="ServiceHoursCertificateCard (idle / preparing / ready / expired / revoked / disabled)" height={700}>
              <CertificateHarness />
            </BodyFrame>

            <BodyFrame title="ServiceHoursCertificateCard (no openExternal -> degraded copy-the-link)" height={520}>
              <CapabilitiesProvider value={CAPS_WITHOUT_OPEN_EXTERNAL}>
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  <ServiceHoursCertificateCard totalHours={12.5} />
                </div>
              </CapabilitiesProvider>
            </BodyFrame>

            <DashboardFrame
              title="EventDashboardBody (portfolio, personal only - no orgs)"
              data={dashboardSoloData}
              height={860}
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame
              title="EventDashboardBody (portfolio, org tabs + picker - switch to Org for money + collaborators)"
              height={900}
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame
              title="EventDashboardBody (portfolio, WIDE)"
              height={900}
              wide
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame
              title="EventDashboardBody (portfolio, nothing hosted yet)"
              data={dashboardEmptyData}
              height={720}
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame
              title="EventDashboardBody (every portfolio query PENDING)"
              data={dashboardPendingData}
              height={520}
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame
              title="EventDashboardBody (every portfolio query FAILING)"
              data={dashboardErrorData}
              height={620}
            >
              <EventDashboardBody />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (phase: upcoming)" height={820}>
              <HostModeBody id={DASHBOARD_EVENT_IDS.upcoming} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (phase: live)" height={820}>
              <HostModeBody id={DASHBOARD_EVENT_IDS.live} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (phase: live, WIDE)" height={820} wide>
              <HostModeBody id={DASHBOARD_EVENT_IDS.live} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (phase: ended)" height={820}>
              <HostModeBody id={DASHBOARD_EVENT_IDS.ended} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (phase: cancelled)" height={820}>
              <HostModeBody id={DASHBOARD_EVENT_IDS.cancelled} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (counters + insights PENDING)" height={620}>
              <HostModeBody id={DASHBOARD_EVENT_PENDING_ID} />
            </DashboardFrame>

            <DashboardFrame title="HostModeBody (counters + insights FAILING)" height={620}>
              <HostModeBody id={DASHBOARD_EVENT_ERROR_ID} />
            </DashboardFrame>

            <BodyFrame title="ReportFlowBody (report wizard - capture/category/details/review)" height={760}>
              <ReportFlowBody />
            </BodyFrame>

            <BodyFrame title='BodyRouter(view="reports") -> ReportsBody'>
              <div data-router="view-reports" style={{ flex: 1, display: "flex" }}>
                <BodyRouter entry={null} view="reports" />
              </div>
            </BodyFrame>

            <BodyFrame title='BodyRouter(kind="people") -> SocialBody'>
              <div data-router="kind-people" style={{ flex: 1, display: "flex" }}>
                <BodyRouter entry={{ kind: "people" }} view="home" />
              </div>
            </BodyFrame>
          </div>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
