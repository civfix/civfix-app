/**
 * groupWizard (P4 Task 4.7) - the PURE step-gating + draft normalization behind the New-group wizard
 * (NewGroupBody). RN-free so it unit-tests directly under vitest (like memberSelect / chatPowers).
 *
 * The wizard's two steps mirror Telegram's flow:
 *   1. "members"  - pick who to add. Next is gated on at least ONE selected member (a group of just
 *                   yourself is created implicitly by the server adding the creator as owner, but an
 *                   empty invite list is a dead room - the server contract allows it, the UX does not).
 *   2. "identity" - avatar / name / description. Create is gated on a non-blank name within the
 *                   contract's 80-char cap (the description cap is 500; enforced by maxLength + here).
 */
/** Mirrors CreateChatGroupRequestSchema's `name: max(80)` (shared exports no named constant). */
export const GROUP_NAME_MAX = 80
/** Mirrors CreateChatGroupRequestSchema's `description: max(500)`. */
export const GROUP_DESCRIPTION_MAX = 500

export type GroupWizardStep = "members" | "identity"

/** Step 1 -> 2 gate: at least one member picked. */
export function canProceedToIdentity(selectedCount: number): boolean {
  return selectedCount >= 1
}

/** Step 2 Create gate: the TRIMMED name is non-empty and within the contract cap. */
export function canCreateGroup(name: string, description = ""): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= 1 &&
    trimmed.length <= GROUP_NAME_MAX &&
    description.trim().length <= GROUP_DESCRIPTION_MAX
  )
}

/** The normalized create payload fields: trimmed name; trimmed description or ABSENT when blank. */
export function normalizeGroupDraft(
  name: string,
  description: string,
): { name: string; description?: string } {
  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  return {
    name: trimmedName,
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  }
}
