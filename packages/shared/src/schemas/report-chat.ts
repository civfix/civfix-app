import { z } from "zod"
import { IdSchema } from "./common.js"
import { PersonDTOSchema } from "./entities.js"
import { RoomKindSchema } from "../types/ws.js"

export const JoinReportChatRequestSchema = z.object({ id: IdSchema }).strict()
export type JoinReportChatRequest = z.infer<typeof JoinReportChatRequestSchema>

export const LeaveReportChatRequestSchema = z.object({ id: IdSchema }).strict()
export type LeaveReportChatRequest = z.infer<typeof LeaveReportChatRequestSchema>

export const ReportChatParticipantDTOSchema = z.object({
  user: PersonDTOSchema,
  role: z.enum(["owner", "member"]),
  joinedAt: z.string(),
})
export type ReportChatParticipantDTO = z.infer<typeof ReportChatParticipantDTOSchema>

export const ReportChatParticipantsResponseSchema = z.object({
  participants: z.array(ReportChatParticipantDTOSchema),
  total: z.number().int().nonnegative(),
})
export type ReportChatParticipantsResponse = z.infer<typeof ReportChatParticipantsResponseSchema>

export const ToggleMuteRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    muted: z.boolean(),
  })
  .strict()
export type ToggleMuteRequest = z.infer<typeof ToggleMuteRequestSchema>

export const ToggleMuteResponseSchema = z.object({ muted: z.boolean() })
export type ToggleMuteResponse = z.infer<typeof ToggleMuteResponseSchema>

export const ToggleHiddenRequestSchema = z
  .object({
    roomKind: RoomKindSchema,
    roomId: IdSchema,
    hidden: z.boolean(),
  })
  .strict()
export type ToggleHiddenRequest = z.infer<typeof ToggleHiddenRequestSchema>

export const ToggleHiddenResponseSchema = z.object({ hidden: z.boolean() })
export type ToggleHiddenResponse = z.infer<typeof ToggleHiddenResponseSchema>
