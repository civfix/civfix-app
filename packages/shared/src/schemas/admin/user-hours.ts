import { z } from "zod"
import { IdSchema, ISODateSchema, pageResponse } from "../common.js"
import { MAX_EVENT_HOURS, MIN_EVENT_HOURS, VolunteerHoursSourceSchema } from "../volunteer.js"
import { AdminReasonSchema } from "./common.js"

/**
 * Admin users surface, Hours tab (DECISIONS §58): an operator reads a user's whole volunteer-hours
 * ledger, voided rows included, and corrects it by crediting an event, crediting a manual adjustment,
 * or voiding an entry. Every write is attributed to the CivFix official account on the user's side;
 * the human operator and the reason exist only on this plane.
 */

export const ADMIN_USER_HOURS_PAGE_MAX = 50

/** `id` fills the :id path param; the client omits it from the serialized query. */
export const AdminUserHoursQuerySchema = z
  .object({
    id: IdSchema,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(ADMIN_USER_HOURS_PAGE_MAX).optional(),
  })
  .strict()
export type AdminUserHoursQuery = z.infer<typeof AdminUserHoursQuerySchema>

/** A calendar date (`YYYY-MM-DD`) with no time zone: the day a manual credit's service happened. */
const CalendarDateSchema = z.string().date()

/**
 * `z.string().date()` accepts any four-digit year, including 0000, which Postgres `date` rejects;
 * without a floor such a value would reach the insert and fail as a 500 instead of a VALIDATION error.
 * The floor lives on the credit request only, so a stored row keeps parsing if it is ever raised.
 */
export const SERVICE_DATE_MIN = "2000-01-01"

export const ServiceDateSchema = CalendarDateSchema.refine((date) => date >= SERVICE_DATE_MIN, {
  message: `Service date must be on or after ${SERVICE_DATE_MIN}`,
})
export type ServiceDate = z.infer<typeof ServiceDateSchema>

const AdminHoursPersonRefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
  })
  .strict()

export const AdminUserHoursEntryDTOSchema = z
  .object({
    id: IdSchema,
    source: VolunteerHoursSourceSchema,
    hours: z.number().nonnegative(),
    occurredAt: ISODateSchema,
    creditedAt: ISODateSchema,
    /** Set on manual rows only. */
    serviceDate: CalendarDateSchema.nullable(),
    event: z
      .object({
        id: IdSchema,
        title: z.string(),
        referenceCode: z.string().nullable(),
      })
      .strict()
      .nullable(),
    /** Null for manual rows, which count toward the total but toward no jurisdiction's leaderboard. */
    jurisdiction: z
      .object({
        geoid: z.string(),
        name: z.string().nullable(),
      })
      .strict()
      .nullable(),
    /** The account the user sees as the creditor; `official` marks the CivFix official account. */
    creditedBy: z
      .object({
        id: IdSchema,
        name: z.string(),
        handle: z.string(),
        official: z.boolean(),
      })
      .strict()
      .nullable(),
    /** The human operator behind an official credit. Never projected to any user-facing surface. */
    operator: AdminHoursPersonRefSchema.nullable(),
    /** The operator's credit reason. Internal: excluded from the user's reads and data export. */
    note: z.string().nullable(),
    voidedAt: ISODateSchema.nullable(),
    voidedBy: AdminHoursPersonRefSchema.nullable(),
    voidReason: z.string().nullable(),
    /** False for voided rows and for historical report credits, which only a migration may touch. */
    voidable: z.boolean(),
  })
  .strict()
export type AdminUserHoursEntryDTO = z.infer<typeof AdminUserHoursEntryDTOSchema>

/** `totalHours` is computed exactly as the user's profile total, so the two can never disagree. */
export const AdminUserHoursTotalsSchema = z
  .object({
    totalHours: z.number().nonnegative(),
    liveEntries: z.number().int().nonnegative(),
    voidedEntries: z.number().int().nonnegative(),
  })
  .strict()
export type AdminUserHoursTotals = z.infer<typeof AdminUserHoursTotalsSchema>

export const AdminUserHoursResponseSchema = pageResponse(AdminUserHoursEntryDTOSchema).extend({
  totals: AdminUserHoursTotalsSchema,
})
export type AdminUserHoursResponse = z.infer<typeof AdminUserHoursResponseSchema>

const AdminCreditHoursSchema = z.number().min(MIN_EVENT_HOURS).max(MAX_EVENT_HOURS)

/**
 * `kind` picks the ledger source. An event credit obeys every event rule except roster membership;
 * a manual credit has no event and no jurisdiction, so it carries the service date instead. The
 * server refuses a `serviceDate` in the future: "today" depends on a time zone the contract lacks.
 */
export const AdminCreditUserHoursRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: IdSchema,
      kind: z.literal("event"),
      eventId: IdSchema,
      hours: AdminCreditHoursSchema,
      reason: AdminReasonSchema,
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      kind: z.literal("manual"),
      hours: AdminCreditHoursSchema,
      serviceDate: ServiceDateSchema,
      reason: AdminReasonSchema,
    })
    .strict(),
])
export type AdminCreditUserHoursRequest = z.infer<typeof AdminCreditUserHoursRequestSchema>

export const AdminCreditUserHoursResponseSchema = z
  .object({
    entryId: IdSchema,
    totalHours: z.number().nonnegative(),
  })
  .strict()
export type AdminCreditUserHoursResponse = z.infer<typeof AdminCreditUserHoursResponseSchema>

export const AdminVoidUserHoursRequestSchema = z
  .object({
    id: IdSchema,
    entryId: IdSchema,
    reason: AdminReasonSchema,
  })
  .strict()
export type AdminVoidUserHoursRequest = z.infer<typeof AdminVoidUserHoursRequestSchema>

/**
 * The live certificates whose frozen snapshot lists the voided entry. They keep verifying with the
 * old total, so the operator is shown them to revoke through the CLI.
 */
export const AdminVoidUserHoursResponseSchema = z
  .object({
    ok: z.literal(true),
    affectedCertificates: z.array(
      z
        .object({
          code: z.string(),
          issuedAt: ISODateSchema,
        })
        .strict(),
    ),
  })
  .strict()
export type AdminVoidUserHoursResponse = z.infer<typeof AdminVoidUserHoursResponseSchema>
