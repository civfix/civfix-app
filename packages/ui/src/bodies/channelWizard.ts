/**
 * The step-gating behind the New-channel wizard. Unlike a group (members first), a channel leads with
 * IDENTITY, since the creator broadcasts and subscribers join later:
 *
 *   1. "identity"   - avatar / name / description. Next is gated on a non-blank name within the
 *                     contract cap (the SAME gate as the group create step).
 *   2. "visibility" - Private (default) or Public. Always satisfiable: the radio carries a default,
 *                     so the step can never block Next.
 *   3. "members"    - an OPTIONAL initial subscriber list. Create never looks at the count: a channel
 *                     with zero subscribers is valid (the owner broadcasts; people join later).
 *
 * Identity fields + caps live in groupWizard (GROUP_NAME_MAX / GROUP_DESCRIPTION_MAX / canCreateGroup /
 * normalizeGroupDraft), so both wizards mirror CreateChatGroupRequestSchema from one place.
 */
import { canCreateGroup } from "./groupWizard"

export type ChannelWizardStep = "identity" | "visibility" | "members"

/** The channel's visibility choice (mirrors CreateChatGroupRequestSchema's `visibility` enum). */
export type ChannelVisibility = "private" | "public"

/** The visibility radio's default selection (a channel is private until the creator opens it). */
export const CHANNEL_DEFAULT_VISIBILITY: ChannelVisibility = "private"

export function canProceedFromChannelIdentity(name: string, description = ""): boolean {
  return canCreateGroup(name, description)
}

export function isChannelVisibilityValid(visibility: ChannelVisibility): boolean {
  return visibility === "private" || visibility === "public"
}

/** Subscribers are optional, so the Create gate never inspects the selection count. */
export function canCreateChannel(name: string, description = ""): boolean {
  return canCreateGroup(name, description)
}
