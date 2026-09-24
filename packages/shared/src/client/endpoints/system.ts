import { z } from "zod"
import { def } from "./def.js"
import { GetLegalVersionsResponseSchema } from "../../schemas/legal.js"

const HealthzResponseSchema = z.object({ ok: z.literal(true) }).passthrough()

export const systemEndpoints = {
  health: def({
    method: "GET",
    path: "/healthz",
    request: null,
    response: HealthzResponseSchema,
    auth: "public",
    csrf: false,
    version: "unversioned",
  }),
  getLegalVersions: def({
    method: "GET",
    path: "/legal/versions",
    request: null,
    response: GetLegalVersionsResponseSchema,
    auth: "public",
    csrf: false,
    version: "v1",
  }),
} as const
