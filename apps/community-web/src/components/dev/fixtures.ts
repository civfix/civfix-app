import type { ApiClient } from "@civfix/shared/client"
import type {
  ChatHistoryResponse,
  ChatMessageDTO,
  LeaderboardEntryDTO,
  ListNotificationsResponse,
  ListThreadsResponse,
  NotificationPrefsDTO,
  PersonDTO,
  SearchUsersResponse,
  UserDTO,
  UserProfileDTO,
} from "@civfix/shared"
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "@civfix/shared"

export const isoFromNow = (ms: number): string => new Date(Date.now() + ms).toISOString()
export const hoursAgo = (h: number): string => isoFromNow(-h * MS_PER_HOUR)
export const daysAgo = (d: number): string => isoFromNow(-d * MS_PER_DAY)

export const GALLERY_VIEWER = {
  id: "me",
  displayName: "Sam Okafor",
  handle: "samok",
  avatarUrl: null,
  role: "user",
  allowDirectMessages: true,
  showVolunteerHours: true,
} as unknown as UserDTO

export const GALLERY_MY_PROFILE: UserProfileDTO = {
  id: "me",
  name: "Sam Okafor",
  handle: "samok",
  bio: "Reporting potholes and joining neighborhood cleanups around the Mission.",
  avatar: null,
  avatarUrl: null,
  followers: 42,
  following: 31,
  isFollowing: false,
  pastEvents: [],
  stats: { reports: 5, fixed: 3, cleanups: 3 },
  volunteerHours: 12.5,
  showVolunteerHours: true,
}

export const GALLERY_SEARCH_RESULTS: SearchUsersResponse = {
  results: [
    { id: "p-ann", handle: "annrivera", displayName: "Ann Rivera", avatar: null, avatarUrl: null },
    { id: "p-lee", handle: "leetran", displayName: "Lee Tran", avatar: null, avatarUrl: null },
    { id: "p-mei", handle: "meiwong", displayName: "Mei Wong", avatar: null, avatarUrl: null },
  ],
}

export const GALLERY_NOTIFICATIONS: ListNotificationsResponse["items"] = [
  {
    id: "n1",
    type: "report_update",
    title: "Your pothole report is in progress",
    body: "The city crew has been assigned to inspect the site this week.",
    read: false,
    createdAt: hoursAgo(2),
    link: "/pin/r-pothole",
  },
  {
    id: "n2",
    type: "cleanup_reminder",
    title: "Creekside litter sweep is tomorrow",
    body: "Don't forget gloves - meet at the Dolores Park gate at 9am.",
    read: true,
    createdAt: hoursAgo(20),
    link: "/cleanups/e1",
  },
]

export const GALLERY_NOTIFICATION_PREFS: NotificationPrefsDTO = {
  push: true,
  mentions: true,
  cleanupChat: true,
  reportUpdates: true,
  follows: false,
  postInteractions: true,
  hostBroadcasts: true,
  quietHours: { start: "22:00", end: "07:00" },
}

export function galleryThreads(dmPeer: PersonDTO): ListThreadsResponse {
  return {
    items: [
      {
        id: "th-crew",
        kind: "cleanup",
        title: "Creekside litter sweep",
        refId: "e1",
        last: "Bring gloves - we have extra bags at the gate.",
        lastFromMe: false,
        ago: "2h",
        unread: 3,
        members: 8,
        muted: false,
      },
      {
        id: "th-dm",
        kind: "dm",
        title: "Ann Rivera",
        refId: "dm-ann",
        peer: dmPeer,
        last: "Thanks for joining Saturday!",
        lastFromMe: true,
        ago: "1d",
        unread: 0,
        members: 0,
        muted: false,
      },
    ],
    nextCursor: null,
  }
}

function chatMessage(
  id: string,
  fromId: string,
  fromName: string,
  body: string,
  minsAgo: number,
): ChatMessageDTO {
  return {
    id,
    cleanupId: "",
    from: {
      id: fromId,
      name: fromName,
      avatar: null,
      followers: 0,
      following: 0,
      isFollowing: false,
    },
    body,
    kind: "text",
    createdAt: isoFromNow(-minsAgo * MS_PER_MINUTE),
  } as ChatMessageDTO
}

const GALLERY_CHAT_MESSAGES: readonly ChatMessageDTO[] = [
  chatMessage("m1", "p-ann", "Ann Rivera", "Morning! Meeting at the Dolores Park gate at 9.", 180),
  chatMessage("m2", "p-lee", "Lee Tran", "On my way - bringing a wagon for the heavy bags.", 150),
  chatMessage("m3", "me", "Sam Okafor", "Nice. I have grabbers for four people.", 120),
  chatMessage("m4", "p-ann", "Ann Rivera", "Bring gloves - we have extra bags at the gate.", 90),
]

export function galleryChatHistory(roomId: string): ChatHistoryResponse {
  return {
    items: GALLERY_CHAT_MESSAGES.map((m) => ({ ...m, cleanupId: roomId })),
    nextCursor: null,
  }
}

export const GALLERY_LEADERBOARD_PODIUM: readonly LeaderboardEntryDTO[] = [
  { rank: 1, userId: "p-ann", name: "Ann Rivera", handle: "annrivera", avatar: null, avatarUrl: null, hours: 61.5 },
  { rank: 2, userId: "p-lee", name: "Lee Tran", handle: "leetran", avatar: null, avatarUrl: null, hours: 48 },
  { rank: 3, userId: "p-mei", name: "Mei Wong", handle: "meiwong", avatar: null, avatarUrl: null, hours: 39.25 },
]

export type FakeEndpoint = (args?: unknown) => Promise<unknown>

/**
 * Only own entries count as stubbed, so an inherited name such as "constructor" reaches the fallback
 * instead of answering with an Object.prototype member. "then" stays undefined because a thenable client
 * would be swallowed by any await or Promise.resolve that touches it.
 */
export function makeCannedApi(
  canned: Readonly<Record<string, unknown>>,
  fallback: (name: string) => unknown,
): ApiClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined
        const name = String(prop)
        return Object.hasOwn(canned, name) ? canned[name] : fallback(name)
      },
    },
  ) as ApiClient
}
