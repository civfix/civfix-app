/**
 * The per-member management matrix for the group-info roster. Given the VIEWER's role, the TARGET row's role and whether the row is the viewer themselves, return
 * the ordered action keys the row's overflow kebab may offer. Client-side mirror of the server's
 * membership guards (the server re-checks every request); unit-tested as a full matrix.
 *
 * The rules (mirroring the shared groups contract):
 *   - Your OWN row offers nothing (leaving is the body's main Leave button, not a row action).
 *   - The OWNER's row is untouchable by everyone (exactly one owner, fixed at creation).
 *   - The owner can promote a member ("make-admin"), demote an admin ("remove-admin"), and remove either.
 *   - An admin can remove plain MEMBERS only - never another admin, never roles (role changes are
 *     owner-only: SetGroupMemberRole is server-gated to the owner).
 *   - A plain member (or a non-member viewer, role null) manages nobody.
 */
import type { GroupRole } from "@civfix/shared"

/** An action the roster row's kebab may offer, in render order. */
export type GroupMemberActionKey = "make-admin" | "remove-admin" | "remove"

/**
 * The allowed row actions for `viewerRole` acting on a `targetRole` row. `isSelf` marks the viewer's
 * own row (always empty - see the module doc). Returns a NEW array in stable render order:
 * the role toggle (owner only) first, then "remove".
 */
export function groupMemberActions(
  viewerRole: GroupRole | null | undefined,
  targetRole: GroupRole,
  isSelf: boolean,
): GroupMemberActionKey[] {
  if (isSelf) return []
  if (targetRole === "owner") return []
  if (viewerRole === "owner") {
    return targetRole === "admin" ? ["remove-admin", "remove"] : ["make-admin", "remove"]
  }
  if (viewerRole === "admin") {
    return targetRole === "member" ? ["remove"] : []
  }
  return []
}
