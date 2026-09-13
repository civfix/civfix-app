---
"@civfix/shared": minor
---

Host tools batch. Slots may be shifts: `EventSlotDTO`/`EventSlotInput` gain `startsAt`/`endsAt` (both-or-neither, ≥ `MIN_SLOT_DURATION_MINUTES`, inside the event window; `MAX_GENERATED_SHIFTS`). Hours by organization: `OrganizationDTO` gains `volunteerHours`/`volunteerCount`; `MyVolunteerHoursDTO` and `PublicVolunteerHoursResponse` gain `byOrganization: OrgHoursDTO[]`; `EventInsights` gains `topVolunteers`; `HostedEventsAnalyticsResponse` gains `totalHours`, `volunteersCredited`, `topVolunteers`; `HostedEventDTO` gains `hoursCredited`. `LeaderboardEntryDTO` moves to `entities.ts` (re-exported from `volunteer.ts`, same names). `timeRangeLabel` added to `datetime`. All additive; registry unchanged.
