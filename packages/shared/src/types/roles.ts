import { z } from "zod"

/**
 * Application roles. A user may hold more than one (e.g. a gov_admin is also a gov_user).
 */
export const RoleSchema = z.enum(["citizen", "gov_user", "gov_admin", "operator"])
export type Role = z.infer<typeof RoleSchema>

/**
 * Resolved auth context attached to a request after authentication/authorization.
 * `userId` is null for unauthenticated and anonymous-token flows.
 */
export interface AuthContext {
  userId: string | null
  roles: Role[]
  anon: boolean
  anonSessionId?: string
}
