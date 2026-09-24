import { def } from "../def.js"
import { HomeSummaryResponseSchema, HomeMapResponseSchema } from "../../../schemas/admin/home.js"
import { ActivityListQuerySchema, ActivityListResponseSchema } from "../../../schemas/admin/activity.js"
import { AuditListQuerySchema, AuditListResponseSchema } from "../../../schemas/admin/audit.js"
import { SystemHealthResponseSchema } from "../../../schemas/admin/system.js"

export const adminOverviewEndpoints = {
  adminHomeSummary: def({
    method: "GET",
    path: "/admin/home/summary",
    request: null,
    response: HomeSummaryResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  adminHomeMap: def({
    method: "GET",
    path: "/admin/home/map",
    request: null,
    response: HomeMapResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  adminActivity: def({
    method: "GET",
    path: "/admin/activity",
    request: ActivityListQuerySchema,
    response: ActivityListResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  adminSystemHealth: def({
    method: "GET",
    path: "/admin/system/health",
    request: null,
    response: SystemHealthResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
  listAudit: def({
    method: "GET",
    path: "/admin/audit",
    request: AuditListQuerySchema,
    response: AuditListResponseSchema,
    auth: "required",
    csrf: false,
    version: "v1",
  }),
} as const
