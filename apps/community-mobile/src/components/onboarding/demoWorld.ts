import type { ChatItem, CleanupDTO, PersonDTO, ReportStatus, ReportType } from "@civfix/shared"
import { TOGETHER_EVENT_SPOT, TRACK_PINS } from "./onboardingMapScenes"

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

export const DEMO_HOURS_CREDITED = 2.5
export const DEMO_GOING_BEFORE = 2
export const DEMO_GOING_AFTER = 3

export const DEMO_EVENT_LAT = TOGETHER_EVENT_SPOT.lat
export const DEMO_EVENT_LNG = TOGETHER_EVENT_SPOT.lng

export const DEMO_REPORT_ID = "onboarding-report"

export const REPORT_STAGE_TYPES: readonly ReportType[] = ["dump", "graffiti", "pavement"]
export const REPORT_STAGE_SELECTED_INDEX = 1

export const TRACK_CLUSTER_MEMBERS: readonly number[] = [5, 6]
export const TRACK_CLUSTER_COUNT = 3

export const TRACK_ROW_PIN_INDEX = 0
export const DEMO_REPORT_LAT = TRACK_PINS[TRACK_ROW_PIN_INDEX].spot.lat
export const DEMO_REPORT_LNG = TRACK_PINS[TRACK_ROW_PIN_INDEX].spot.lng

export const TRACK_STATUS_CYCLE: readonly ReportStatus[] = ["published", "in_progress", "resolved"]

export function demoCleanup(
  title: string,
  address: string,
  going: number,
  scheduledAt: string,
): CleanupDTO {
  return {
    id: "onboarding-cleanup",
    title,
    type: "site",
    eventKind: "cleanup",
    lat: DEMO_EVENT_LAT,
    lng: DEMO_EVENT_LNG,
    scheduledAt,
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

export function demoChatItems(
  askBody: string,
  replyBody: string,
  sentAt: readonly [string, string],
): ChatItem[] {
  return [
    {
      message: {
        id: "onboarding-message-1",
        cleanupId: DEMO_REPORT_ID,
        roomKind: "report",
        from: null,
        body: askBody,
        kind: "text",
        createdAt: sentAt[0],
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
        createdAt: sentAt[1],
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
