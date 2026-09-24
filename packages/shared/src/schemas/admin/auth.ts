import { z } from "zod"
import { IdSchema } from "../common.js"
import { RoleSchema } from "../../types/roles.js"
import { SessionResponseSchema } from "../auth.js"

/**
 * Admin / operator authentication via Cloudflare Access (Zero Trust) SSO. The only way to obtain an
 * operator session is `POST /admin/auth/access/exchange`, which carries no request body: the backend
 * cryptographically verifies the `Cf-Access-Jwt-Assertion` header injected by the edge Access app, maps
 * the verified email to the `operator` role (still gated by the `ADMIN_EMAILS` allowlist), and mints a
 * web session.
 */

/**
 * A successful Access exchange yields a session (web cookie + CSRF token, optional bearer for parity).
 * Reuses SessionResponse so the dashboard and the citizen apps share the exact session envelope.
 */
export const AdminLoginResponseSchema = SessionResponseSchema
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>

/** The operator identity shown across the dashboard shell. */
export const AdminOperatorDTOSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    email: z.string().email(),
    role: RoleSchema,
  })
  .strict()
export type AdminOperatorDTO = z.infer<typeof AdminOperatorDTOSchema>

/**
 * GET /admin/auth/session result. `authenticated` is false (operator absent) when there is no valid
 * operator session; otherwise `operator` carries the identity and `csrfToken` lets the SPA recover
 * its token after a reload.
 */
export const AdminSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  operator: AdminOperatorDTOSchema.optional(),
  csrfToken: z.string().optional(),
})
export type AdminSessionResponse = z.infer<typeof AdminSessionResponseSchema>

export const AdminLogoutResponseSchema = z.object({
  ok: z.literal(true),
})
export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>
