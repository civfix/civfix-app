/**
 * One predicate for every detail header's leading control, so the rule is never re-derived per body.
 *
 * Show the chevron when Back navigates; hide it when Back would merely close a surface the user can leave
 * another way. A chevron that only closes promises a parent screen that does not exist.
 *
 * The dock is hidden while any sheet detail is up, so on a compact pull-up the drag is the sole exit:
 * hiding the control on a surface whose drag does not dismiss traps the user. That is what
 * `dismissGesture` states. A full page on the overlay layer has no drag, and PageStack.native's iOS edge
 * swipe must never count as one: it is iOS-only, invisible, and a navigation rather than a dismissal, so
 * PageStack passes `dismissGesture: false` and arms the swipe only where this module answers "back".
 *
 * Root flow kinds (`create-cleanup`, `edit-cleanup`) keep a control because their collapse deliberately
 * no-ops to protect a half-written event; it is a close X, since they have no parent to return to.
 *
 * Not applied to the own-header full bodies (thread, pinned-messages, new-group, new-channel, composer,
 * post-thread, person): `titleForEntry` returns the " " suppression sentinel for them, so no DetailBar is
 * rendered, and their root Back is a real navigation back to the list they cover.
 */
import { isFlowKind, type DetailEntry, type LayoutMode } from "../nav"

export interface BackAffordanceInput {
  stack: readonly DetailEntry[]
  mode: LayoutMode
  /** Passed only by bodies that host a multi-step flow inside one nav entry (the report wizard). */
  stepIndex?: number
  /**
   * Whether the surface has a drag-to-dismiss gesture (the compact pull-up does, a full page does not).
   * The compact-root hide branch is only safe when it does: iOS has no hardware back.
   */
  dismissGesture?: boolean
}

export function showBackAffordance({
  stack,
  mode,
  stepIndex = 0,
  dismissGesture = true,
}: BackAffordanceInput): boolean {
  if (stepIndex > 0) return true
  if (stack.length > 1) return true
  // The landscape panel has no dismiss gesture, and the rail is no substitute: `selectView` leaves for
  // another surface and clears the stack, while Back returns to the one underneath.
  if (mode === "expanded") return true
  // Must sit above the compact-root branch, whose only justification is the drag.
  if (!dismissGesture) return true
  // A compact root: the drag already closes it, except for flow kinds, whose collapse no-ops.
  const root = stack[0]
  return root !== undefined && isFlowKind(root.kind)
}

export type DetailLeadingAffordance = "back" | "close" | "none"

/**
 * Refines {@link showBackAffordance} (it calls it, so the two never disagree about whether a control
 * appears) by splitting "yes" into a chevron that navigates and an X that only closes. The only way to
 * reach "close" is a compact-root flow kind, whose drag refuses to dismiss it and which has nothing below.
 *
 * Expanded stays a chevron even at the stack root and on an empty stack, because the landscape card cannot
 * be closed: with one entry `back()` pops to the view root, and with an empty stack the report wizard's
 * Back (`leaveReportFlow`) restores the surface it was launched from into the same card. Do not simplify
 * this to close-on-any-root or narrow it to `stack.length === 1`.
 *
 * On a page root (`dismissGesture: false`) the flow test runs first so a root flow page keeps its X; any
 * other page root gets a chevron because `back()` at depth 1 pops to the origin view the store guarantees
 * is underneath.
 */
export function detailLeadingAffordance(input: BackAffordanceInput): DetailLeadingAffordance {
  if (!showBackAffordance(input)) return "none"
  const { stack, mode, stepIndex = 0 } = input
  if (stepIndex > 0) return "back"
  if (stack.length > 1) return "back"
  if (mode === "expanded") return "back"
  const root = stack[0]
  if (root !== undefined && isFlowKind(root.kind)) return "close"
  return "back"
}
