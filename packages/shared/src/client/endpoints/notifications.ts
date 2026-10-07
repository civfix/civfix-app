import { def } from "./def.js"
import {
  ListNotificationsResponseSchema,
  MarkReadRequestSchema,
  MarkReadResponseSchema,
  GetNotificationPrefsResponseSchema,
  UpdateNotificationPrefsRequestSchema,
  RegisterPushTokenRequestSchema,
  RegisterPushTokenResponseSchema,
  UnregisterPushTokenRequestSchema,
} from "../../schemas/notifications.js"
import { PaginationQuerySchema } from "../../schemas/common.js"

export const notificationEndpoints = {
  listNotifications: def({
    method: "GET",
    path: "/notifications",
    request: PaginationQuerySchema,
    response: ListNotificationsResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  markNotificationsRead: def({
    method: "POST",
    path: "/notifications/read",
    request: MarkReadRequestSchema,
    response: MarkReadResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
  getNotificationPrefs: def({
    method: "GET",
    path: "/notifications/prefs",
    request: null,
    response: GetNotificationPrefsResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  updateNotificationPrefs: def({
    method: "PUT",
    path: "/notifications/prefs",
    request: UpdateNotificationPrefsRequestSchema,
    response: GetNotificationPrefsResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),

  registerPush: def({
    method: "POST",
    path: "/push/register",
    request: RegisterPushTokenRequestSchema,
    response: RegisterPushTokenResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),

  pushUnregister: def({
    method: "POST",
    path: "/push/unregister",
    request: UnregisterPushTokenRequestSchema,
    response: RegisterPushTokenResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
} as const
