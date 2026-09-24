import type { CleanupDTO, LinkedEventRef } from "@civfix/shared"

export function linkedEventToCleanup(event: LinkedEventRef): CleanupDTO {
  return {
    id: event.id,
    title: event.title,
    type: "site",
    eventKind: event.eventKind,
    lat: event.lat,
    lng: event.lng,
    scheduledAt: event.scheduledAt,
    endsAt: event.endsAt ?? null,
    timezone: event.timezone ?? null,
    status: event.status,
    organizer: event.organizer,
    going: event.going,
    joined: false,
    bring: [],
    address: null,
    description: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
  }
}
