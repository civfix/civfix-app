/**
 * User-created group / channel chat rooms. A "group" is member-writable; a "channel" is broadcast-style
 * (only the owner and admins post, server enforced). Rooms ride the unified chat rails via roomKind
 * "group" (history shape, edit/pin/mute, WS frames), so only the group management surface lives here.
 */
import { z } from "zod"
import { IdSchema, ISODateSchema } from "./common.js"
import { ChatHistoryQueryShape, rejectAroundWithBefore } from "./chat.js"
import { MediaDTOSchema, PersonDTOSchema } from "./entities.js"

export const GroupRoleSchema = z.enum(["owner", "admin", "member"])
export type GroupRole = z.infer<typeof GroupRoleSchema>

export const ChatGroupDTOSchema = z.object({
  id: IdSchema,
  kind: z.enum(["group", "channel"]),
  name: z.string(),
  description: z.string().nullable().optional(),
  avatar: MediaDTOSchema.nullable().optional(),
  visibility: z.enum(["private", "public"]),
  ownerId: IdSchema,
  memberCount: z.number().int(),
  // Null or omitted means not a member (public groups are viewable before joining).
  myRole: GroupRoleSchema.nullable().optional(),
  muted: z.boolean().default(false),
  createdAt: ISODateSchema,
})
export type ChatGroupDTO = z.infer<typeof ChatGroupDTOSchema>

export const GroupMemberDTOSchema = z.object({
  user: PersonDTOSchema,
  role: GroupRoleSchema,
  joinedAt: ISODateSchema,
})
export type GroupMemberDTO = z.infer<typeof GroupMemberDTOSchema>

export const CreateChatGroupRequestSchema = z
  .object({
    kind: z.enum(["group", "channel"]).default("group"),
    name: z.string().min(1).max(80),
    description: z.string().max(500).optional(),
    avatarUploadId: IdSchema.optional(),
    visibility: z.enum(["private", "public"]).default("private"),
    memberIds: z.array(IdSchema).max(50).default([]),
  })
  .strict()
export type CreateChatGroupRequest = z.infer<typeof CreateChatGroupRequestSchema>

export const GetChatGroupRequestSchema = z.object({ id: IdSchema }).strict()
export type GetChatGroupRequest = z.infer<typeof GetChatGroupRequestSchema>

/**
 * Set-only patch: an omitted field is unchanged. Clear the description with an empty string; there is
 * no null sentinel on this contract.
 */
export const UpdateChatGroupRequestSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(500).optional(),
    avatarUploadId: IdSchema.optional(),
    visibility: z.enum(["private", "public"]).optional(),
  })
  .strict()
export type UpdateChatGroupRequest = z.infer<typeof UpdateChatGroupRequestSchema>

/**
 * Group rooms page over the same rails as every other room kind, so the window shape and the
 * `around`/`before` mutual-exclusion rule come from schemas/chat.ts rather than being re-declared here.
 */
export const GroupHistoryRequestSchema = ChatHistoryQueryShape.extend({
  id: IdSchema,
})
  .strict()
  .superRefine(rejectAroundWithBefore)
export type GroupHistoryRequest = z.infer<typeof GroupHistoryRequestSchema>

export const AddGroupMembersRequestSchema = z
  .object({
    id: IdSchema,
    memberIds: z.array(IdSchema).min(1).max(50),
  })
  .strict()
export type AddGroupMembersRequest = z.infer<typeof AddGroupMembersRequestSchema>

export const RemoveGroupMemberRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
  })
  .strict()
export type RemoveGroupMemberRequest = z.infer<typeof RemoveGroupMemberRequestSchema>

// Owner is not assignable: there is exactly one owner, fixed at creation.
export const SetGroupMemberRoleRequestSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    role: z.enum(["admin", "member"]),
  })
  .strict()
export type SetGroupMemberRoleRequest = z.infer<typeof SetGroupMemberRoleRequestSchema>

export const ListGroupMembersRequestSchema = z
  .object({
    id: IdSchema,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
export type ListGroupMembersRequest = z.infer<typeof ListGroupMembersRequestSchema>

export const ListGroupMembersResponseSchema = z.object({
  members: z.array(GroupMemberDTOSchema),
  nextCursor: z.string().nullable(),
})
export type ListGroupMembersResponse = z.infer<typeof ListGroupMembersResponseSchema>

export const DeleteGroupMessageRequestSchema = z
  .object({
    id: IdSchema,
    messageId: IdSchema,
  })
  .strict()
export type DeleteGroupMessageRequest = z.infer<typeof DeleteGroupMessageRequestSchema>
