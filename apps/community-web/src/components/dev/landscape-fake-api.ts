import type { ApiClient } from "@civfix/shared/client"
import type {
  ChatHistoryResponse,
  CleanupAttendeesResponse,
  CleanupDTO,
  GetMyHoursResponse,
  GetProfileResponse,
  JurisdictionDTO,
  LeaderboardResponse,
  ListMyReportsResponse,
  ListNotificationsResponse,
  MarkReadResponse,
  PersonDTO,
  ReportClusterResponse,
  ReportDTO,
  UserProfileDTO,
} from "@civfix/shared"
import { MS_PER_DAY } from "@civfix/shared"
import { makeFakeApiClient } from "@civfix/ui/data"

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
  isoFromNow,
  makeCannedApi,
} from "./fixtures"

function person(id: string, name: string, handle: string, extra: Partial<PersonDTO> = {}): PersonDTO {
  return {
    id,
    name,
    handle,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers: 96,
    following: 41,
    isFollowing: false,
    ...extra,
  }
}

const ANN = person("p-ann", "Ann Rivera", "annrivera", { followers: 128 })
const LEE = person("p-lee", "Lee Tran", "leetran")
const MEI = person("p-mei", "Mei Wong", "meiwong")

const PERSON_PROFILE: UserProfileDTO = {
  ...GALLERY_MY_PROFILE,
  id: "p-ann",
  name: "Ann Rivera",
  handle: "annrivera",
  bio: "Park steward and weekend cleanup organizer.",
  followers: 128,
  following: 64,
  volunteerHours: 61.5,
}

function cleanup(
  id: string,
  title: string,
  inDays: number,
  organizer: PersonDTO,
  extra: Partial<CleanupDTO> = {},
): CleanupDTO {
  return {
    id,
    title,
    type: "site",
    eventKind: "cleanup",
    description: "Gloves, bags and grabbers provided. Meet at the gate; we finish by noon.",
    lat: 37.77,
    lng: -122.42,
    scheduledAt: isoFromNow(inDays * MS_PER_DAY),
    status: "upcoming",
    organizer,
    going: 12,
    joined: false,
    bring: [],
    address: "Dolores Park, San Francisco",
    linkedReports: [],
    slots: [],
    dist: 1.2,
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
    ...extra,
  }
}

const UPCOMING_CLEANUPS: CleanupDTO[] = [
  cleanup("e1", "Creekside litter sweep", 2, ANN, { joined: true, going: 8, dist: 0.4 }),
  cleanup("e2", "Mission mural touch-up", 5, LEE, { going: 14, dist: 2.6 }),
  cleanup("e5", "Dolores Park planting", 6, MEI, { going: 5, dist: 1.1 }),
  cleanup("e6", "Bayview shoreline sweep", 8, ANN, { going: 21, dist: 3.4 }),
]

const CLEANUPS_BY_ID: Record<string, CleanupDTO> = Object.fromEntries(
  UPCOMING_CLEANUPS.map((c) => [c.id, c]),
)

const PAST_EVENTS: CleanupDTO[] = [
  cleanup("e3", "24th St planter day", -4, ANN, { status: "done", joined: true, going: 9 }),
  cleanup("e4", "Bayview shoreline cleanup", -14, MEI, { status: "done", joined: true, going: 17 }),
]

const ATTENDEES: CleanupAttendeesResponse = {
  attendees: [
    { ...ANN, role: "organizer", slot: null },
    { ...LEE, role: "member", slot: null },
    { ...MEI, role: "member", slot: null },
  ],
  going: 8,
  scope: "following",
}

function report(
  id: string,
  category: ReportDTO["category"],
  title: string,
  status: ReportDTO["status"],
): ReportDTO {
  const createdAt = daysAgo(3)
  return {
    id,
    category,
    title,
    description:
      "Reported via civfix. It is getting worse after the rain and is a hazard for people on bikes.",
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
    mediaPending: 0,
    linkedEvents: [],
    timeline: [{ status: "submitted", at: createdAt, note: null }],
  }
}

const MY_REPORTS: ListMyReportsResponse = {
  items: [
    report("r-pothole", "hazard", "Deep pothole on Mission St", "in_progress"),
    report("r-graffiti", "graffiti", "Tagging on the library wall", "submitted"),
    report("r-trash", "trash", "Overflowing bin at the bus stop", "resolved"),
  ],
  nextCursor: null,
}

const PIN_SEEDS = [
  { id: "r-pothole", category: "hazard", status: "in_progress", at: [0.38, 0.44] },
  { id: "r-trash", category: "trash", status: "published", at: [0.52, 0.58] },
  { id: "r-graffiti", category: "graffiti", status: "published", at: [0.61, 0.37] },
  { id: "r-light", category: "hazard", status: "published", at: [0.45, 0.66] },
] as const

function pinsIn(bbox: unknown): ReportClusterResponse["pins"] {
  const b = bbox as { west: number; south: number; east: number; north: number } | undefined
  const west = b?.west ?? -122.45
  const south = b?.south ?? 37.74
  const east = b?.east ?? -122.39
  const north = b?.north ?? 37.79
  return PIN_SEEDS.map((p) => ({
    id: p.id,
    category: p.category,
    status: p.status,
    lat: south + (north - south) * p.at[1],
    lng: west + (east - west) * p.at[0],
  }))
}

function chatHistory(args?: Record<string, unknown>): ChatHistoryResponse {
  return galleryChatHistory(String(args?.cleanupId ?? args?.threadId ?? args?.id ?? ""))
}

const THREADS = galleryThreads(ANN)

const NOTIFICATIONS: ListNotificationsResponse = {
  items: GALLERY_NOTIFICATIONS,
  nextCursor: null,
}

const MY_HOURS: GetMyHoursResponse = {
  hours: {
    totalHours: 12.5,
    byJurisdiction: [
      { geoid: "0667000", name: "San Francisco", hours: 10.2 },
      { geoid: "0644000", name: "Los Angeles", hours: 2.3 },
    ],
    byOrganization: [],
  },
}

const LEADERBOARD: LeaderboardResponse = {
  geoid: "0667000",
  jurisdictionName: "San Francisco",
  entries: [...GALLERY_LEADERBOARD_PODIUM],
  nextOffset: null,
  participantCount: 42,
  viewerRank: 11,
  viewerHours: 12.5,
}

const JURISDICTION: JurisdictionDTO = {
  geoid: "0667000",
  name: "San Francisco Public Works",
  layer: "place",
  cityStateLabel: "San Francisco, CA",
  routable: true,
}

const sharedFake = makeFakeApiClient() as unknown as Record<string, unknown>

const canned: Record<string, (args?: Record<string, unknown>) => Promise<unknown>> = {
  myProfile: async (): Promise<GetProfileResponse> => ({
    profile: { ...GALLERY_MY_PROFILE, pastEvents: PAST_EVENTS },
  }),
  getProfile: async (args): Promise<GetProfileResponse> => ({
    profile: { ...(args?.id === "me" ? GALLERY_MY_PROFILE : PERSON_PROFILE), pastEvents: PAST_EVENTS },
  }),
  searchUsers: async () => GALLERY_SEARCH_RESULTS,
  followSuggestions: async () => ({ results: [ANN, LEE, MEI] }),
  listFollowers: async () => ({ items: [LEE, MEI], nextCursor: null }),
  listFollowing: async () => ({ items: [ANN], nextCursor: null }),
  updateSettings: async () => ({ user: GALLERY_VIEWER }),

  listCleanups: async (args) => ({
    items: args?.when === "attending" ? UPCOMING_CLEANUPS.filter((c) => c.joined) : UPCOMING_CLEANUPS,
    nextCursor: null,
  }),
  getCleanup: async (args) => CLEANUPS_BY_ID[String(args?.id ?? "")] ?? UPCOMING_CLEANUPS[0]!,
  getCleanupAttendees: async () => ATTENDEES,
  getEventHours: async () => ({ scope: "self", entries: [], anyLogged: false }),

  listMyReports: async () => MY_REPORTS,
  getReport: async (args) =>
    MY_REPORTS.items.find((r) => r.id === args?.id) ?? MY_REPORTS.items[0]!,
  searchReports: async () => ({ items: pinsIn(undefined), nextCursor: null }),
  mapReports: async (args): Promise<ReportClusterResponse> => ({
    clusters: [],
    pins: pinsIn(args?.bbox),
  }),
  resolveJurisdiction: async () => JURISDICTION,
  reverseLabel: async () => ({ label: "2401 Mission St, San Francisco, CA" }),

  listThreads: async () => THREADS,
  cleanupMessages: async (args) => chatHistory(args),
  dmMessages: async (args) => chatHistory(args),
  groupMessages: async (args) => chatHistory(args),
  reportMessages: async (args) => chatHistory(args),

  listNotifications: async () => NOTIFICATIONS,
  markNotificationsRead: async (): Promise<MarkReadResponse> => ({ ok: true }),
  getNotificationPrefs: async () => GALLERY_NOTIFICATION_PREFS,
  updateNotificationPrefs: async () => GALLERY_NOTIFICATION_PREFS,

  getMyHours: async () => MY_HOURS,
  getMyHoursEntries: async () => ({ items: [], nextCursor: null }),
  getPublicVolunteerHours: async () => ({ items: [], nextCursor: null }),
  getJurisdictionLeaderboard: async () => LEADERBOARD,
}

export const landscapeFakeApi: ApiClient = makeCannedApi(canned, (name) => sharedFake[name])
