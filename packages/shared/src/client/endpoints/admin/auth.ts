import { def } from "../def.js"
import {
  AdminLoginResponseSchema,
  AdminSessionResponseSchema,
  AdminLogoutResponseSchema,
} from "../../../schemas/admin/auth.js"

export const adminAuthEndpoints = {
  adminAccessExchange: def({
    method: "POST",
    path: "/admin/auth/access/exchange",
    request: null,
    response: AdminLoginResponseSchema,
    auth: "public",
    csrf: false,
    version: "v1",
  }),
  adminSession: def({
    method: "GET",
    path: "/admin/auth/session",
    request: null,
    response: AdminSessionResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  adminLogout: def({
    method: "POST",
    path: "/admin/auth/logout",
    request: null,
    response: AdminLogoutResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
} as const
