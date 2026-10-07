import { z } from "zod"
import { IdSchema, pageResponse } from "../common.js"
import { EventKindSchema, LinkedReportRefSchema } from "../entities.js"
import {
  AdminActorRefSchema,
  AdminCoordsSchema,
  AdminListQuerySchema,
  EventStatusSchema,
  RelAbsTimeSchema,
} from "./common.js"

/** An organizer reference, reusing the shared actor ref (id/name/handle/joined). */
export const EventOrganizerSchema = AdminActorRefSchema
export type EventOrganizer = z.infer<typeof EventOrganizerSchema>

/** An event-detail timeline entry (who/what/when + icon kind). */
export const EventTimelineItemSchema = z
  .object({
    who: z.string(),
    what: z.string(),
    when: z.string(),
    kind: z.enum([
      "create",
      "status",
      "join",
      "message",
      "done",
      "warn",
      "cancel",
      "linked",
      "unlinked",
    ]),
  })
  .strict()
export type EventTimelineItem = z.infer<typeof EventTimelineItemSchema>

/** A message posted to the cleanup group. */
export const EventMessageSchema = z
  .object({
    who: z.string(),
    text: z.string(),
    when: z.string(),
  })
  .strict()
export type EventMessage = z.infer<typeof EventMessageSchema>

/**
 * An event list row. `attendees`/`capacity` drive the turnout bar; `bags` is the post-event outcome.
 * `date` carries both the relative and absolute timestamp. `status` is the cleanup lifecycle status.
 */
export const AdminEventListItemDTOSchema = z
  .object({
    id: z.string(),
    status: EventStatusSchema,
    // Defaults to "cleanup" so an older server's response still parses.
    eventKind: EventKindSchema.default("cleanup"),
    flagged: z.boolean(),
    title: z.string(),
    place: z.string(),
    attendees: z.number().int().nonnegative(),
    capacity: z.number().int().nonnegative().nullable(),
    bags: z.number().int().nonnegative(),
    organizer: EventOrganizerSchema,
    date: RelAbsTimeSchema,
    coords: AdminCoordsSchema,
  })
  .strict()
export type AdminEventListItemDTO = z.infer<typeof AdminEventListItemDTOSchema>

/** Event list query: search matches title/place/id/organizer; `filter` is the status+flag facet. */
export const AdminEventListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "upcoming", "in_progress", "completed", "flagged"]).optional(),
})
export type AdminEventListQuery = z.infer<typeof AdminEventListQuerySchema>

/**
 * Per-facet event totals for the filter chips, computed server-side over the SEARCHED set (so the chip
 * numbers are accurate + stable across the facet rather than capped to the first keyset page). `all` is
 * the total (incl. cancelled); upcoming/in_progress/completed are the visible chips; flagged is orthogonal.
 */
export const AdminEventCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    flagged: z.number().int().nonnegative(),
  })
  .strict()
export type AdminEventCounts = z.infer<typeof AdminEventCountsSchema>

export const AdminEventListResponseSchema = pageResponse(AdminEventListItemDTOSchema).extend({
  counts: AdminEventCountsSchema,
})
export type AdminEventListResponse = z.infer<typeof AdminEventListResponseSchema>

/** Full event detail: the list shape plus description, address, timeline, and attendee messages. */
export const AdminEventDTOSchema = AdminEventListItemDTOSchema.extend({
  desc: z.string(),
  address: z.string(),
  timeline: z.array(EventTimelineItemSchema),
  messages: z.array(EventMessageSchema),
  // The reports this event is linked to. Defaulted so an older server's response still parses.
  linkedReports: z.array(LinkedReportRefSchema).default([]),
}).strict()
export type AdminEventDTO = z.infer<typeof AdminEventDTOSchema>

export const GetAdminEventResponseSchema = AdminEventDTOSchema
export type GetAdminEventResponse = z.infer<typeof GetAdminEventResponseSchema>

/** Set the event status (writes the cleanup timeline; audited). */
export const SetEventStatusRequestSchema = z
  .object({
    id: z.string(),
    status: EventStatusSchema,
  })
  .strict()
export type SetEventStatusRequest = z.infer<typeof SetEventStatusRequestSchema>

// `flagged` sets the marker to that value so a retried request cannot undo itself; without it the
// request toggles, as older admin builds expect.
export const FlagEventRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
    flagged: z.boolean().optional(),
  })
  .strict()
export type FlagEventRequest = z.infer<typeof FlagEventRequestSchema>

/** Cancel an event (status `cancelled`). */
export const CancelRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().max(500).optional(),
  })
  .strict()
export type CancelRequest = z.infer<typeof CancelRequestSchema>

export const PostMessageRequestSchema = z
  .object({
    id: z.string(),
    body: z.string().min(1).max(4000),
  })
  .strict()
export type PostMessageRequest = z.infer<typeof PostMessageRequestSchema>

/**
 * Log a cleanup's outcome: the number of bags collected. This is the ONLY write path for cleanups.bags;
 * without it the bags stats on the events + analytics surfaces read as no-data. Writes a
 * cleanup_timeline 'outcome' row.
 */
export const SetEventOutcomeRequestSchema = z
  .object({
    id: z.string(),
    bags: z.number().int().nonnegative().max(100000),
  })
  .strict()
export type SetEventOutcomeRequest = z.infer<typeof SetEventOutcomeRequestSchema>

/** Link one or more reports to an event. `id` fills the :id path param. */
export const LinkEventReportsRequestSchema = z
  .object({
    id: z.string(),
    reportIds: z.array(IdSchema).max(100),
  })
  .strict()
export type LinkEventReportsRequest = z.infer<typeof LinkEventReportsRequestSchema>
