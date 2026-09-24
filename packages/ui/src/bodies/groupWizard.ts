/**
 * The step-gating and draft normalization behind the New-group wizard. RN-free so it unit-tests directly
 * under vitest.
 *
 * The wizard's two steps mirror Telegram's flow:
 *   1. "members"  - pick who to add. Next is gated on at least ONE selected member (a group of just
 *                   yourself is created implicitly by the server adding the creator as owner, but an
 *                   empty invite list is a dead room - the server contract allows it, the UX does not).
 *   2. "identity" - avatar / name / description. Create is gated on a non-blank name within the
 *                   contract's 80-char cap (the description cap is 500; enforced by maxLength + here).
 */
import type { ChatGroupDTO } from "@civfix/shared"
import type { DetailEntry } from "../nav"

/** Mirrors CreateChatGroupRequestSchema's `name: max(80)` (shared exports no named constant). */
export const GROUP_NAME_MAX = 80
/** Mirrors CreateChatGroupRequestSchema's `description: max(500)`. */
export const GROUP_DESCRIPTION_MAX = 500

export type GroupWizardStep = "members" | "identity"

export function canProceedToIdentity(selectedCount: number): boolean {
  return selectedCount >= 1
}

export function canCreateGroup(name: string, description = ""): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= 1 &&
    trimmed.length <= GROUP_NAME_MAX &&
    description.trim().length <= GROUP_DESCRIPTION_MAX
  )
}

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

/** The wizard's own entry is replaced, so Back from the new room returns to where the wizard opened. */
export function stackOpeningGroup(
  stack: readonly DetailEntry[],
  group: Pick<ChatGroupDTO, "id" | "name">,
): DetailEntry[] {
  return [...stack.slice(0, -1), { kind: "thread", id: group.id, roomKind: "group", title: group.name }]
}
