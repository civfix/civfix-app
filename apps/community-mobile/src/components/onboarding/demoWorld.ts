import type {
  ChatItem,
  CleanupDTO,
  PersonDTO,
  ReportCategory,
  ReportStatus,
  ReportType,
} from "@civfix/shared"

export const DEMO_ORGANIZER: PersonDTO = {
  id: "onboarding-organizer",
  name: "Maya Alvarez",
  handle: "demo_maya",
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

export const DEMO_NEIGHBOR: PersonDTO = {
  id: "onboarding-neighbor",
  name: "Devon Okafor",
  handle: "demo_devon",
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

export const DEMO_ATTENDEES: readonly PersonDTO[] = [
  DEMO_ORGANIZER,
  DEMO_NEIGHBOR,
  {
    id: "onboarding-attendee",
    name: "Priya Raman",
    handle: "demo_priya",
    avatar: null,
    avatarUrl: null,
    followers: 0,
    following: 0,
    isFollowing: false,
  },
]

export const DEMO_EVENT_AT = "2026-09-12T16:00:00.000Z"
export const DEMO_CHAT_AT = ["2026-09-05T18:41:00.000Z", "2026-09-05T18:44:00.000Z"] as const

export const DEMO_HOURS_CREDITED = 2.5
export const DEMO_GOING_BEFORE = 2
export const DEMO_GOING_AFTER = 3

export const DEMO_EVENT_LAT = 34.0782
export const DEMO_EVENT_LNG = -118.2606

export const DEMO_REPORT_ID = "onboarding-report"
export const DEMO_REPORT_LAT = 34.0709
export const DEMO_REPORT_LNG = -118.2547

export const REPORT_STAGE_TYPES: readonly ReportType[] = ["dump", "graffiti", "pavement"]
export const REPORT_STAGE_SELECTED_INDEX = 1

export interface DemoPin {
  readonly category: ReportCategory
  readonly x: number
  readonly y: number
  readonly rise: number
}

export const TRACK_PINS: readonly DemoPin[] = [
  { category: "trash", x: 0.17, y: 0.29, rise: 1.7 },
  { category: "graffiti", x: 0.4, y: 0.18, rise: 1.1 },
  { category: "hazard", x: 0.71, y: 0.31, rise: 2 },
  { category: "water", x: 0.85, y: 0.55, rise: 1.3 },
  { category: "encampment", x: 0.28, y: 0.6, rise: 1.5 },
  { category: "recycling", x: 0.54, y: 0.47, rise: 1.2 },
  { category: "other", x: 0.65, y: 0.61, rise: 1.8 },
]

export const TRACK_CLUSTER_MEMBERS: readonly number[] = [5, 6]
export const TRACK_CLUSTER_X = 0.595
export const TRACK_CLUSTER_Y = 0.545
export const TRACK_CLUSTER_COUNT = 3

export const TRACK_ROW_PIN_INDEX = 0

export const TRACK_STATUS_CYCLE: readonly ReportStatus[] = ["published", "in_progress", "resolved"]

export const TOGETHER_EVENT_PIN_X = 0.31
export const TOGETHER_EVENT_PIN_Y = 0.52

export function demoCleanup(title: string, address: string, going: number): CleanupDTO {
  return {
    id: "onboarding-cleanup",
    title,
    type: "site",
    eventKind: "cleanup",
    lat: DEMO_EVENT_LAT,
    lng: DEMO_EVENT_LNG,
    scheduledAt: DEMO_EVENT_AT,
    status: "upcoming",
    organizer: DEMO_ORGANIZER,
    going,
    joined: false,
    bring: [],
    address,
    linkedReports: [],
    slots: [],
    visibility: "public",
    myCapabilities: [],
    galleryUrls: [],
    ticketTypes: [],
  }
}

export function demoChatItems(askBody: string, replyBody: string): ChatItem[] {
  return [
    {
      message: {
        id: "onboarding-message-1",
        cleanupId: DEMO_REPORT_ID,
        roomKind: "report",
        from: null,
        body: askBody,
        kind: "text",
        createdAt: DEMO_CHAT_AT[0],
        reactions: [],
        mentions: [],
        mine: true,
      },
      pending: false,
      failed: false,
      mine: true,
    },
    {
      message: {
        id: "onboarding-message-2",
        cleanupId: DEMO_REPORT_ID,
        roomKind: "report",
        from: DEMO_NEIGHBOR,
        body: replyBody,
        kind: "text",
        createdAt: DEMO_CHAT_AT[1],
        reactions: [],
        mentions: [],
        mine: false,
      },
      pending: false,
      failed: false,
      mine: false,
    },
  ]
}
