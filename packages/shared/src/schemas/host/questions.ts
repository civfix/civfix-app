import { z } from "zod"
import { EventQuestionKindSchema, IdSchema, ISODateSchema } from "../common.js"
import { SortOrderInputSchema } from "../internal-fields.js"


export { EventQuestionKindSchema } from "../common.js"
export type { EventQuestionKind } from "../common.js"

export const MAX_EVENT_QUESTIONS = 20
export const MAX_QUESTION_PROMPT = 200
export const MAX_QUESTION_HELP = 300
export const MAX_QUESTION_OPTIONS = 30
export const MAX_QUESTION_OPTION_LABEL = 120
export const MAX_SHORT_TEXT_ANSWER = 200
export const MAX_LONG_TEXT_ANSWER = 2000
export const MAX_QUESTION_OPTION_VALUE = 80
export const MAX_CONSENT_TEXT = 2000

export const EventQuestionOptionSchema = z
  .object({
    value: z.string().trim().min(1).max(MAX_QUESTION_OPTION_VALUE),
    label: z.string().trim().min(1).max(MAX_QUESTION_OPTION_LABEL),
  })
  .strict()
export type EventQuestionOption = z.infer<typeof EventQuestionOptionSchema>

export const EventQuestionConditionSchema = z
  .object({
    questionId: IdSchema,
    equals: z.union([z.string().max(MAX_QUESTION_OPTION_VALUE), z.boolean()]),
  })
  .strict()
export type EventQuestionCondition = z.infer<typeof EventQuestionConditionSchema>

const EventQuestionCommonFields = {
  id: IdSchema.optional(),
  prompt: z.string().trim().min(1).max(MAX_QUESTION_PROMPT),
  helpText: z.string().max(MAX_QUESTION_HELP).nullable().optional(),
  required: z.boolean().default(false),
  ticketTypeId: IdSchema.nullable().optional(),
  sortOrder: SortOrderInputSchema,
  showIf: EventQuestionConditionSchema.nullable().optional(),
} as const

const EventQuestionDefUnionSchema = z.discriminatedUnion("kind", [
  z.object({ ...EventQuestionCommonFields, kind: z.literal("short_text") }).strict(),
  z.object({ ...EventQuestionCommonFields, kind: z.literal("long_text") }).strict(),
  z
    .object({
      ...EventQuestionCommonFields,
      kind: z.literal("single_select"),
      options: z.array(EventQuestionOptionSchema).min(1).max(MAX_QUESTION_OPTIONS),
    })
    .strict(),
  z
    .object({
      ...EventQuestionCommonFields,
      kind: z.literal("multi_select"),
      options: z.array(EventQuestionOptionSchema).min(1).max(MAX_QUESTION_OPTIONS),
      maxSelections: z.number().int().min(1).max(MAX_QUESTION_OPTIONS).nullable().optional(),
    })
    .strict(),
  z.object({ ...EventQuestionCommonFields, kind: z.literal("checkbox") }).strict(),
  z
    .object({
      ...EventQuestionCommonFields,
      kind: z.literal("consent"),
      consentText: z.string().trim().min(1).max(MAX_CONSENT_TEXT),
    })
    .strict(),
])
export type EventQuestionDef = z.infer<typeof EventQuestionDefUnionSchema>

export const EventQuestionDefSchema: z.ZodType<EventQuestionDef, z.ZodTypeDef, unknown> =
  EventQuestionDefUnionSchema

const EventQuestionDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  kind: EventQuestionKindSchema,
  prompt: z.string(),
  helpText: z.string().nullable().optional(),
  required: z.boolean().default(false),
  ticketTypeId: IdSchema.nullable().optional(),
  options: z.array(EventQuestionOptionSchema).default([]),
  maxSelections: z.number().int().positive().nullable().optional(),
  consentText: z.string().nullable().optional(),
  showIf: EventQuestionConditionSchema.nullable().optional(),
  sortOrder: z.number().int().default(0),
  archivedAt: ISODateSchema.nullable().optional(),
})
export type EventQuestionDTO = z.infer<typeof EventQuestionDTOObjectSchema>
export const EventQuestionDTOSchema: z.ZodType<EventQuestionDTO, z.ZodTypeDef, unknown> =
  EventQuestionDTOObjectSchema

export const ListEventQuestionsRequestSchema = z
  .object({ id: IdSchema, ticketTypeId: IdSchema.optional() })
  .strict()
export type ListEventQuestionsRequest = z.infer<typeof ListEventQuestionsRequestSchema>

const ListEventQuestionsResponseObjectSchema = z.object({
  items: z.array(EventQuestionDTOSchema),
})
export type ListEventQuestionsResponse = z.infer<typeof ListEventQuestionsResponseObjectSchema>
export const ListEventQuestionsResponseSchema: z.ZodType<ListEventQuestionsResponse, z.ZodTypeDef, unknown> =
  ListEventQuestionsResponseObjectSchema

export const SaveEventQuestionsRequestSchema = z
  .object({
    id: IdSchema,
    questions: z.array(EventQuestionDefSchema).max(MAX_EVENT_QUESTIONS),
  })
  .strict()
export type SaveEventQuestionsRequest = z.infer<typeof SaveEventQuestionsRequestSchema>

const SaveEventQuestionsResponseObjectSchema = z.object({
  items: z.array(EventQuestionDTOSchema),
})
export type SaveEventQuestionsResponse = z.infer<typeof SaveEventQuestionsResponseObjectSchema>
export const SaveEventQuestionsResponseSchema: z.ZodType<SaveEventQuestionsResponse, z.ZodTypeDef, unknown> =
  SaveEventQuestionsResponseObjectSchema

export const EventAnswerValueSchema = z.union([
  z.string().max(MAX_LONG_TEXT_ANSWER),
  z.array(z.string().max(MAX_QUESTION_OPTION_LABEL)).max(MAX_QUESTION_OPTIONS),
  z.boolean(),
])
export type EventAnswerValue = z.infer<typeof EventAnswerValueSchema>

export const EventAnswerInputSchema = z
  .object({
    questionId: IdSchema,
    value: EventAnswerValueSchema,
  })
  .strict()
export type EventAnswerInput = z.infer<typeof EventAnswerInputSchema>
