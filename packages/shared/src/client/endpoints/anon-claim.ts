import { def } from "./def.js"
import {
  AnonReportRequestSchema,
  AnonReportResponseSchema,
  AnonReportStatusRequestSchema,
  AnonReportStatusResponseSchema,
} from "../../schemas/anon.js"
import {
  ClaimNudgeRequestSchema,
  ClaimNudgeResponseSchema,
  ClaimReportRequestSchema,
  ClaimReportResponseSchema,
} from "../../schemas/claim.js"

export const anonClaimEndpoints = {
  anonCreateReport: def({
    method: "POST",
    path: "/anon/reports",
    request: AnonReportRequestSchema,
    response: AnonReportResponseSchema,
    auth: "public",
    csrf: false,
    version: "v1",
  }),
  anonReportStatus: def({
    method: "GET",
    path: "/anon/reports/:id/status",
    request: AnonReportStatusRequestSchema,
    response: AnonReportStatusResponseSchema,
    auth: "public",
    csrf: false,
    version: "v1",
  }),

  claimNudge: def({
    method: "POST",
    path: "/claim/nudge",
    request: ClaimNudgeRequestSchema,
    response: ClaimNudgeResponseSchema,
    auth: "optional",
    csrf: false,
    version: "v1",
  }),
  claimReport: def({
    method: "POST",
    path: "/claim/report",
    request: ClaimReportRequestSchema,
    response: ClaimReportResponseSchema,
    auth: "required",
    csrf: true,
    version: "v1",
  }),
} as const
