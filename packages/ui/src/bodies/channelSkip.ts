/**
 * Subscribers are OPTIONAL on the channel wizard's last step, so the header offers a fast path past an
 * empty picker. Skip shares onCreate with the footer's Create button, and onCreate always submits the
 * current selection - so Skip must only be offered while NOTHING is selected. Otherwise "Skip" would
 * create the channel WITH the very subscribers the user just asked to skip (Skip and Create being the
 * same action wearing different labels).
 * Extracted rather than inlined so the invariant "Skip is never a mislabeled Create" is pinned by a test.
 */
import type { ChannelWizardStep } from "./channelWizard"

export function shouldOfferChannelSkip(step: ChannelWizardStep, selectedCount: number): boolean {
  return step === "members" && selectedCount === 0
}
