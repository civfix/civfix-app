import { z } from "zod"
import { IdSchema, ISODateSchema } from "./common.js"
import {
  LeaderboardEntryDTOSchema as LeaderboardEntryDTOSchemaInternal,
  OrganizationRefDTOSchema,
  OrgHoursDTOSchema as OrgHoursDTOSchemaInternal,
} from "./entities.js"

/**
 * `"report"` is HISTORICAL ONLY and must stay in this list. Nothing writes a report credit any more
 * (filing a report is not volunteer service), but pre-2026-07-28 ledger rows, the frozen `snapshot` of
 * every already-issued certificate, and older servers all still carry the value — dropping it would make
 * those payloads fail to parse. Do NOT add a new source that credits reports.
 */
export const VOLUNTEER_HOURS_SOURCES = ["report", "event", "manual"] as const
export const VolunteerHoursSourceSchema = z.enum(VOLUNTEER_HOURS_SOURCES)
export type VolunteerHoursSource = z.infer<typeof VolunteerHoursSourceSchema>

/**
 * @deprecated RETIRED 2026-07-28 — filing a report is not volunteer service, and nothing credits it any
 * more. The backend's `awardReportHours` was deleted (interface and both implementations) and
 * services/api/drizzle/0065_void_report_volunteer_hours.sql voided every credit it ever wrote. The
 * constant survives only to document what the historical `source='report'` rows are worth; crediting
 * anything with it would put report filings back on the public leaderboard and on signed PDF transcripts.
 */
export const REPORT_VOLUNTEER_HOURS = 0.1
/** Smallest creditable event-hours amount (2-dp minimum; rounding is enforced backend-side). */
export const MIN_EVENT_HOURS = 0.01
export const MAX_EVENT_HOURS = 24
/**
 * Upper bound on the number of per-attendee rows one LogEventHours call may carry, so the backend
 * imports the cap instead of re-declaring it (volunteer-hours-service.ts). A single event roster is
 * never near this; the cap exists so one request cannot fan out an unbounded write + notify batch.
 */
export const MAX_EVENT_HOURS_ENTRIES = 2000

export const JurisdictionHoursSchema = z.object({
  geoid: z.string(),
  name: z.string().nullable().optional(),
  hours: z.number().nonnegative(),
})
export type JurisdictionHours = z.infer<typeof JurisdictionHoursSchema>

export const MyVolunteerHoursDTOSchema = z.object({
  totalHours: z.number().nonnegative(),
  byJurisdiction: z.array(JurisdictionHoursSchema),
  byOrganization: z.array(OrgHoursDTOSchemaInternal).default([]),
})
export type MyVolunteerHoursDTO = z.infer<typeof MyVolunteerHoursDTOSchema>

export const GetMyHoursResponseSchema = z.object({ hours: MyVolunteerHoursDTOSchema })
export type GetMyHoursResponse = z.infer<typeof GetMyHoursResponseSchema>

/**
 * Who credited a ledger entry. Deliberately NOT a PersonDTO: that type requires follower/following
 * counts the hours domain does not load (the cleanups domain hardcodes them to 0, which implies a
 * social relationship that is not being asserted here).
 */
export const VolunteerHoursCreditorSchema = z.object({
  id: IdSchema,
  name: z.string(),
  handle: z.string().nullable().optional(),
  /**
   * 0.43.0: the creditor's primary organization affiliation (DECISIONS §34), replacing the retired
   * `verified` neighbor flag. Null when the creditor belongs to no organization.
   */
  organization: OrganizationRefDTOSchema.nullable().optional(),
})
export type VolunteerHoursCreditor = z.infer<typeof VolunteerHoursCreditorSchema>

/** One line of the service-hours transcript. */
export const VolunteerHoursEntryDTOSchema = z.object({
  id: IdSchema,
  source: VolunteerHoursSourceSchema,
  hours: z.number().nonnegative(),
  /** When the service happened (event scheduledAt; falls back to creditedAt for report/manual). */
  occurredAt: ISODateSchema,
  /** When the credit was written to the ledger. Drives the keyset cursor. */
  creditedAt: ISODateSchema,
  eventId: IdSchema.nullable().optional(),
  eventTitle: z.string().nullable().optional(),
  eventReferenceCode: z.string().nullable().optional(),
  reportId: IdSchema.nullable().optional(),
  jurisdictionGeoid: z.string().nullable().optional(),
  jurisdictionName: z.string().nullable().optional(),
  creditedBy: VolunteerHoursCreditorSchema.nullable().optional(),
})
export type VolunteerHoursEntryDTO = z.infer<typeof VolunteerHoursEntryDTOSchema>

/** GET /me/volunteer-hours/entries - the signed-in user's own itemised ledger. */
export const MyVolunteerHoursEntriesQuerySchema = z
  .object({
    cursor: z.string().optional(),
    // Coerced because this validates a GET query string, where every value arrives as a string.
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
export type MyVolunteerHoursEntriesQuery = z.infer<typeof MyVolunteerHoursEntriesQuerySchema>

export const MyVolunteerHoursEntriesResponseSchema = z.object({
  items: z.array(VolunteerHoursEntryDTOSchema).default([]),
  nextCursor: z.string().nullable().default(null),
  totalHours: z.number().nonnegative().default(0),
})
export type MyVolunteerHoursEntriesResponse = z.infer<typeof MyVolunteerHoursEntriesResponseSchema>

/** GET /people/:id/volunteer-hours - `id` consumes the path param (static suffix, merge pattern). */
export const PublicVolunteerHoursQuerySchema = z
  .object({
    id: IdSchema,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
export type PublicVolunteerHoursQuery = z.infer<typeof PublicVolunteerHoursQuerySchema>

export const PublicVolunteerHoursResponseSchema = z.object({
  /**
   * false = the owner has show_volunteer_hours off (or the account is gone). Reported HONESTLY
   * rather than folded into "0 hours": conflating them would make the UI print "0 hours" for
   * somebody who has simply opted out, which is a lie. The privacy interest is in the NUMBERS.
   */
  visible: z.boolean().default(false),
  totalHours: z.number().nonnegative().default(0),
  byJurisdiction: z.array(JurisdictionHoursSchema).default([]),
  byOrganization: z.array(OrgHoursDTOSchemaInternal).default([]),
  /**
   * EVENT entries only. A public, itemised list of every report a user filed is a privacy leak (reports
   * can be held, unlisted or sensitive), and the id alone would deep-link into them.
   */
  items: z.array(VolunteerHoursEntryDTOSchema).default([]),
  /**
   * @deprecated ALWAYS 0 since 2026-07-28. Report filings are not volunteer service and are no longer
   * credited, so the server emits a hard 0 rather than reading the ledger. The field stays on the wire —
   * it is `.default(0)` and removing it would be a hard break for shipped clients — but do not render it.
   */
  reportHours: z.number().nonnegative().default(0),
  nextCursor: z.string().nullable().default(null),
})
export type PublicVolunteerHoursResponse = z.infer<typeof PublicVolunteerHoursResponseSchema>

export { LeaderboardEntryDTOSchema, OrgHoursDTOSchema } from "./entities.js"
export type { LeaderboardEntryDTO, OrgHoursDTO } from "./entities.js"

/**
 * ⚠ `geoid` is NEW and REQUIRED. It consumes the :geoid path param — the client's extractParams
 * pulls it out of this input and queryOmitKeys keeps it out of the query string, exactly like
 * LogEventHoursRequest.id / UserPostsQuery.id. It kills the `as unknown as` cast at
 * packages/ui/src/data/hooks/volunteer.ts:35-39.
 *
 * ⚠⚠ THE BACKEND ROUTE MUST MERGE IT BEFORE PARSING. volunteer-hours.routes.ts:115 currently parses
 * this schema against request.query, which never contains geoid — a required key there turns every
 * leaderboard request into a 422. The route must become
 *   parse(LeaderboardQuerySchema, { ...(request.query as object), geoid })
 * in the SAME release that bumps the shared dep.
 */
export const LeaderboardQuerySchema = z.object({
  geoid: z.string().min(1).max(64),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().nonnegative().max(500).optional(),
})
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>

export const LeaderboardResponseSchema = z.object({
  geoid: z.string(),
  jurisdictionName: z.string().nullable().optional(),
  entries: z.array(LeaderboardEntryDTOSchemaInternal),
  nextOffset: z.number().int().nonnegative().nullable().optional(),
  /**
   * Total ranked volunteers in this jurisdiction. Computed on the FIRST page only (offset 0) so a
   * deep page does not pay for a count; absent on later pages.
   */
  participantCount: z.number().int().nonnegative().optional(),
  /**
   * The signed-in viewer's own standing, even when they are past the fetched page. Null when the
   * viewer has no hours here. Absent for anonymous viewers.
   *
   * ⚠ these two fields make this response VIEWER-DEPENDENT, so one URL now has two bodies. The
   * route must split Cache-Control (public only for the anonymous body, private + Vary: Cookie
   * otherwise) or a shared cache will serve one viewer's rank to everyone.
   */
  viewerRank: z.number().int().positive().nullable().optional(),
  viewerHours: z.number().nonnegative().nullable().optional(),
})
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>

/** One attendee's credited hours in a LogEventHoursRequest. */
export const EventHoursEntrySchema = z
  .object({
    userId: IdSchema,
    hours: z.number().min(MIN_EVENT_HOURS).max(MAX_EVENT_HOURS),
  })
  .strict()
export type EventHoursEntry = z.infer<typeof EventHoursEntrySchema>

/**
 * POST /cleanups/:id/hours (route path unchanged) - PER-ATTENDEE hours: the acting host (organizer or
 * cohost, gated on their standing on the event) credits each listed attendee individually. Every entry's userId must be a member of the cleanup; re-logging upserts per row.
 * This replaced the v1 flat `{ id, hours }` body that credited the same hours to all members - apps
 * and backend move in lockstep, no fallback. `id` consumes the `:id` path param (merge pattern as
 * CancelCleanupRequest). strict() rejects any other key.
 */
export const LogEventHoursRequestSchema = z
  .object({
    id: IdSchema,
    entries: z.array(EventHoursEntrySchema).min(1).max(MAX_EVENT_HOURS_ENTRIES),
  })
  .strict()
export type LogEventHoursRequest = z.infer<typeof LogEventHoursRequestSchema>

/** `credited` = number of attendee rows written (one per entry). */
export const LogEventHoursResponseSchema = z.object({
  credited: z.number().int().nonnegative(),
})
export type LogEventHoursResponse = z.infer<typeof LogEventHoursResponseSchema>

/**
 * GET /cleanups/:id/hours - the read-back of already-logged hours for one event. Same path as the
 * POST above, different method. `id` consumes the `:id` path param, so the route must merge it
 * before parsing (`parse(EventHoursQuerySchema, { ...(request.query as object), id })`).
 */
export const EventHoursQuerySchema = z.object({ id: IdSchema }).strict()
export type EventHoursQuery = z.infer<typeof EventHoursQuerySchema>

/**
 * `scope: "all"` for an acting host (organizer or cohost) - every credited row. `scope: "self"` for
 * anyone else: at most the viewer's OWN row, and an empty `entries` for a non-member.
 *
 * `anyLogged` is what makes the attendee receipt honest. On the "self" branch a plain attendee sees
 * at most their own row, so without this flag the client cannot tell "the host has not logged yet"
 * (pending) from "the host logged and did not credit me" (not-credited) - an uncredited attendee
 * would sit forever on "the host hasn't logged volunteer hours yet", which is factually wrong. It is
 * `.optional()` so an older server still parses; treat `undefined` as `false` (degrade to pending,
 * never lie with not-credited). The server sets it from a cheap EXISTS probe on the "self" branch
 * and derives it from `entries` on the "all" branch.
 */
export const EventHoursResponseSchema = z.object({
  scope: z.enum(["all", "self"]).default("self"),
  entries: z
    .array(
      z.object({
        userId: IdSchema,
        hours: z.number().nonnegative(),
        loggedAt: ISODateSchema,
      }),
    )
    .default([]),
  anyLogged: z.boolean().optional(),
})
export type EventHoursResponse = z.infer<typeof EventHoursResponseSchema>
