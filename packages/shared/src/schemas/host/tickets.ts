import { z } from "zod"
import { IdSchema, ISODateSchema, MAX_PARTY_SIZE, TicketTypeVisibilitySchema } from "../common.js"
import { TicketTypeDTOSchema } from "../entities.js"
import { SortOrderInputSchema } from "../internal-fields.js"
import { MAX_EVENT_QUESTIONS } from "./questions.js"


export { TicketTypeDTOSchema } from "../entities.js"
export type { TicketTypeDTO } from "../entities.js"
export { TicketTypeVisibilitySchema } from "../common.js"
export type { TicketTypeVisibility } from "../common.js"

export const MAX_TICKET_TYPES_PER_EVENT = 20
export const MAX_TICKET_TYPE_NAME = 80
export const MAX_TICKET_TYPE_DESCRIPTION = 600
export const MAX_TICKET_TYPE_CAPACITY = 100000
export { MAX_PARTY_SIZE } from "../common.js"
export const ACCESS_CODE_MIN = 4
export const ACCESS_CODE_MAX = 64

export const AccessCodeSchema = z.string().trim().min(ACCESS_CODE_MIN).max(ACCESS_CODE_MAX)

export const ListEventTicketTypesRequestSchema = z
  .object({ id: IdSchema, accessCode: AccessCodeSchema.optional() })
  .strict()
export type ListEventTicketTypesRequest = z.infer<typeof ListEventTicketTypesRequestSchema>

const ListEventTicketTypesResponseObjectSchema = z.object({
  items: z.array(TicketTypeDTOSchema),
})
export type ListEventTicketTypesResponse = z.infer<typeof ListEventTicketTypesResponseObjectSchema>
export const ListEventTicketTypesResponseSchema: z.ZodType<ListEventTicketTypesResponse, z.ZodTypeDef, unknown> =
  ListEventTicketTypesResponseObjectSchema

export const SALES_WINDOW_ISSUE = {
  path: ["salesClosesAt"] as const,
  message: "must be after salesOpensAt",
}

export function refineSalesWindow(
  value: { salesOpensAt?: string | null; salesClosesAt?: string | null },
  ctx: z.RefinementCtx,
): void {
  const opens = value.salesOpensAt
  const closes = value.salesClosesAt
  if (opens == null || closes == null) return
  if (Date.parse(closes) > Date.parse(opens)) return
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [...SALES_WINDOW_ISSUE.path],
    message: SALES_WINDOW_ISSUE.message,
  })
}

export const CreateEventTicketTypeRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(MAX_TICKET_TYPE_NAME),
    description: z.string().max(MAX_TICKET_TYPE_DESCRIPTION).nullable().optional(),
    capacity: z.number().int().positive().max(MAX_TICKET_TYPE_CAPACITY).nullable().optional(),
    salesOpensAt: ISODateSchema.nullable().optional(),
    salesClosesAt: ISODateSchema.nullable().optional(),
    visibility: TicketTypeVisibilitySchema.default("public"),
    accessCode: AccessCodeSchema.nullable().optional(),
    maxPartySize: z.number().int().min(1).max(MAX_PARTY_SIZE).default(1),
    sortOrder: SortOrderInputSchema,
    waitlistEnabled: z.boolean().default(false),
    questionIds: z.array(IdSchema).max(MAX_EVENT_QUESTIONS).optional(),
  })
  .strict()
  .superRefine(refineSalesWindow)
export type CreateEventTicketTypeRequest = z.infer<typeof CreateEventTicketTypeRequestSchema>

export const CreateEventTicketTypeResponseSchema = TicketTypeDTOSchema
export type CreateEventTicketTypeResponse = z.infer<typeof CreateEventTicketTypeResponseSchema>

export const UpdateEventTicketTypeRequestSchema = z
  .object({
    id: IdSchema,
    ticketTypeId: IdSchema,
    name: z.string().trim().min(1).max(MAX_TICKET_TYPE_NAME).optional(),
    description: z.string().max(MAX_TICKET_TYPE_DESCRIPTION).nullable().optional(),
    capacity: z.number().int().positive().max(MAX_TICKET_TYPE_CAPACITY).nullable().optional(),
    salesOpensAt: ISODateSchema.nullable().optional(),
    salesClosesAt: ISODateSchema.nullable().optional(),
    visibility: TicketTypeVisibilitySchema.optional(),
    accessCode: AccessCodeSchema.nullable().optional(),
    maxPartySize: z.number().int().min(1).max(MAX_PARTY_SIZE).optional(),
    sortOrder: SortOrderInputSchema,
    waitlistEnabled: z.boolean().optional(),
    questionIds: z.array(IdSchema).max(MAX_EVENT_QUESTIONS).optional(),
  })
  .strict()
  .superRefine(refineSalesWindow)
export type UpdateEventTicketTypeRequest = z.infer<typeof UpdateEventTicketTypeRequestSchema>

export const UpdateEventTicketTypeResponseSchema = TicketTypeDTOSchema
export type UpdateEventTicketTypeResponse = z.infer<typeof UpdateEventTicketTypeResponseSchema>

export const DeleteEventTicketTypeRequestSchema = z
  .object({ id: IdSchema, ticketTypeId: IdSchema })
  .strict()
export type DeleteEventTicketTypeRequest = z.infer<typeof DeleteEventTicketTypeRequestSchema>

const DeleteEventTicketTypeResponseObjectSchema = z.object({ ok: z.literal(true) })
export type DeleteEventTicketTypeResponse = z.infer<typeof DeleteEventTicketTypeResponseObjectSchema>
export const DeleteEventTicketTypeResponseSchema: z.ZodType<DeleteEventTicketTypeResponse, z.ZodTypeDef, unknown> =
  DeleteEventTicketTypeResponseObjectSchema

export const ReorderEventTicketTypesRequestSchema = z
  .object({
    id: IdSchema,
    ticketTypeIds: z.array(IdSchema).min(1).max(MAX_TICKET_TYPES_PER_EVENT),
  })
  .strict()
export type ReorderEventTicketTypesRequest = z.infer<typeof ReorderEventTicketTypesRequestSchema>

const ReorderEventTicketTypesResponseObjectSchema = z.object({
  items: z.array(TicketTypeDTOSchema),
})
export type ReorderEventTicketTypesResponse = z.infer<typeof ReorderEventTicketTypesResponseObjectSchema>
export const ReorderEventTicketTypesResponseSchema: z.ZodType<ReorderEventTicketTypesResponse, z.ZodTypeDef, unknown> =
  ReorderEventTicketTypesResponseObjectSchema
