import { def } from "../def.js"
import {
  ModerationListQuerySchema,
  ModerationListResponseSchema,
  GetModerationItemResponseSchema,
  ApproveModerationRequestSchema,
  RemoveModerationRequestSchema,
  HoldModerationRequestSchema,
  AppealModerationRequestSchema,
} from "../../../schemas/admin/moderation.js"
import { AdminOkResponseSchema } from "../../../schemas/admin/common.js"

export const adminModerationEndpoints = {
  listModeration: def({
    method: "GET",
    path: "/admin/moderation",
    request: ModerationListQuerySchema,
    response: ModerationListResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  getModerationItem: def({
    method: "GET",
    path: "/admin/moderation/:id",
    request: null,
    response: GetModerationItemResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  approveModeration: def({
    method: "POST",
    path: "/admin/moderation/:id/approve",
    request: ApproveModerationRequestSchema,
    response: AdminOkResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
  removeModeration: def({
    method: "POST",
    path: "/admin/moderation/:id/remove",
    request: RemoveModerationRequestSchema,
    response: AdminOkResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
  holdModeration: def({
    method: "POST",
    path: "/admin/moderation/:id/hold",
    request: HoldModerationRequestSchema,
    response: AdminOkResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
  appealModeration: def({
    method: "POST",
    path: "/admin/moderation/:id/appeal",
    request: AppealModerationRequestSchema,
    response: AdminOkResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
} as const
