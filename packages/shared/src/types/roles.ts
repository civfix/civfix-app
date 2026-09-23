import { z } from "zod"

/** A user may hold more than one role (a gov_admin is also a gov_user). */
export const RoleSchema = z.enum(["citizen", "gov_user", "gov_admin", "operator"])
export type Role = z.infer<typeof RoleSchema>

/** `userId` is null for unauthenticated and anonymous-token flows. */
export interface AuthContext {
  userId: string | null
  roles: Role[]
  anon: boolean
  anonSessionId?: string
}
