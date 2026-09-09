import { z } from "zod"
import {
  IdSchema,
  ISODateSchema,
  PaginationQuerySchema,
  WaitlistStatusSchema,
  pageResponse,
} from "../common.js"
import { PersonDTOSchema } from "../entities.js"
import { AccessCodeSchema, MAX_PARTY_SIZE } from "./tickets.js"


export { WaitlistStatusSchema } from "../common.js"
export type { WaitlistStatus } from "../common.js"

const EventWaitlistEntryDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  ticketTypeId: IdSchema,
  ticketTypeName: z.string().nullable().optional(),
  person: PersonDTOSchema.nullable().optional(),
  guestName: z.string().nullable().optional(),
  partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).default(1),
  status: WaitlistStatusSchema,
  position: z.number().int().positive().nullable().optional(),
  createdAt: ISODateSchema,
  offeredAt: ISODateSchema.nullable().optional(),
  claimExpiresAt: ISODateSchema.nullable().optional(),
})
export type EventWaitlistEntryDTO = z.infer<typeof EventWaitlistEntryDTOObjectSchema>
export const EventWaitlistEntryDTOSchema: z.ZodType<EventWaitlistEntryDTO, z.ZodTypeDef, unknown> =
  EventWaitlistEntryDTOObjectSchema

export const JoinEventWaitlistRequestSchema = z
  .object({
    id: IdSchema,
    ticketTypeId: IdSchema,
    partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).default(1),
    accessCode: AccessCodeSchema.optional(),
  })
  .strict()
export type JoinEventWaitlistRequest = z.infer<typeof JoinEventWaitlistRequestSchema>

const JoinEventWaitlistResponseObjectSchema = z.object({
  entry: EventWaitlistEntryDTOSchema,
})
export type JoinEventWaitlistResponse = z.infer<typeof JoinEventWaitlistResponseObjectSchema>
export const JoinEventWaitlistResponseSchema: z.ZodType<JoinEventWaitlistResponse, z.ZodTypeDef, unknown> =
  JoinEventWaitlistResponseObjectSchema

export const LeaveEventWaitlistRequestSchema = z
  .object({ id: IdSchema, ticketTypeId: IdSchema.optional() })
  .strict()
export type LeaveEventWaitlistRequest = z.infer<typeof LeaveEventWaitlistRequestSchema>

const LeaveEventWaitlistResponseObjectSchema = z.object({ ok: z.literal(true) })
export type LeaveEventWaitlistResponse = z.infer<typeof LeaveEventWaitlistResponseObjectSchema>
export const LeaveEventWaitlistResponseSchema: z.ZodType<LeaveEventWaitlistResponse, z.ZodTypeDef, unknown> =
  LeaveEventWaitlistResponseObjectSchema

export const ListEventWaitlistRequestSchema = PaginationQuerySchema.extend({
  id: IdSchema,
  ticketTypeId: IdSchema.optional(),
  status: WaitlistStatusSchema.optional(),
}).strict()
export type ListEventWaitlistRequest = z.infer<typeof ListEventWaitlistRequestSchema>

const ListEventWaitlistResponseObjectSchema = pageResponse(EventWaitlistEntryDTOSchema)
export type ListEventWaitlistResponse = z.infer<typeof ListEventWaitlistResponseObjectSchema>
export const ListEventWaitlistResponseSchema: z.ZodType<ListEventWaitlistResponse, z.ZodTypeDef, unknown> =
  ListEventWaitlistResponseObjectSchema

export const WaitlistClaimOutcomeSchema = z.enum([
  "claimed",
  "expired",
  "not_offered",
  "not_found",
])
export type WaitlistClaimOutcome = z.infer<typeof WaitlistClaimOutcomeSchema>

export const ClaimWaitlistOfferRequestSchema = z
  .object({ id: IdSchema, waitlistId: IdSchema })
  .strict()
export type ClaimWaitlistOfferRequest = z.infer<typeof ClaimWaitlistOfferRequestSchema>

const ClaimWaitlistOfferResponseObjectSchema = z.object({
  outcome: WaitlistClaimOutcomeSchema,
  registrationId: IdSchema.nullable(),
})
export type ClaimWaitlistOfferResponse = z.infer<typeof ClaimWaitlistOfferResponseObjectSchema>
export const ClaimWaitlistOfferResponseSchema: z.ZodType<ClaimWaitlistOfferResponse, z.ZodTypeDef, unknown> =
  ClaimWaitlistOfferResponseObjectSchema

export const PromoteFromWaitlistRequestSchema = z
  .object({ id: IdSchema, waitlistId: IdSchema })
  .strict()
export type PromoteFromWaitlistRequest = z.infer<typeof PromoteFromWaitlistRequestSchema>

const PromoteFromWaitlistResponseObjectSchema = z.object({
  entry: EventWaitlistEntryDTOSchema,
})
export type PromoteFromWaitlistResponse = z.infer<typeof PromoteFromWaitlistResponseObjectSchema>
export const PromoteFromWaitlistResponseSchema: z.ZodType<PromoteFromWaitlistResponse, z.ZodTypeDef, unknown> =
  PromoteFromWaitlistResponseObjectSchema
