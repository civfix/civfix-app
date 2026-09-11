/**
 * Does a detail header's leading BACK chevron have somewhere to GO - and if it has nowhere to go, should
 * there be any control there at all?
 *
 * ONE pure predicate for every header that draws one, so the rule cannot be re-derived (and drift)
 * per-body. Pure logic over the nav stack + the layout mode + an optional in-surface wizard step, so it
 * unit-tests directly under vitest with no React Native renderer (house style: see `dragCollapse`,
 * `headerAuthAffordance`, `tabBarLogic`).
 *
 * THE RULE: show the chevron when Back NAVIGATES; hide it when Back would merely CLOSE a surface the user
 * can already leave another way. A chevron that just closes is a lie - it promises a parent screen that
 * does not exist, and on a portrait TAB ROOT it is actively wrong (the reported bug: the report wizard's
 * step 1 and the own-profile pull-up both showed "< " with nothing behind them).
 *
 *   - a wizard step > 0                -> Back steps to the previous step.                        SHOW
 *   - stack.length > 1                 -> a genuine drill-down; Back reveals the parent entry.     SHOW
 *   - EXPANDED (landscape)             -> the side panel is persistent and has no dismiss gesture. The
 *                                         rail beside it switches SURFACES (`selectView`) rather than
 *                                         popping this stack, so Back is still the only way OUT OF A
 *                                         PANEL, to whatever it was opened from.                   SHOW
 *   - COMPACT with NO dismiss gesture   -> the surface is a full PAGE, not a pull-up (`dismissGesture:
 *                                         false`). There is no grab handle to drag and the dock is hidden
 *                                         over a detail, so the control is the SOLE exit.           SHOW
 *   - COMPACT at the root of the stack -> a directly-opened pull-up (`openDetail`, or `push` from an
 *     or with an empty stack              empty stack) or a tab root. Dragging the grab handle down to
 *                                         peek dismisses it, which is the whole gesture vocabulary of a
 *                                         pull-up.                                                 HIDE
 *   - ...UNLESS the root is a FLOW kind -> `collapseToParent` deliberately no-ops for those, so a
 *                                         drag-to-peek does NOT dismiss them; the control is their only
 *                                         exit and must survive at the root.                       SHOW
 *
 * THE HIDE BRANCH USED TO SAY "the grab handle dismisses the sheet and the dock switches tabs". The dock
 * half is FALSE and was actively misleading: `shell/bodyLayout` computes
 * `bottomChromeVisible: !fullSocialModal && detailPresentation !== "sheet"`, so the dock is HIDDEN for the
 * entire time any sheet detail is up. The drag is therefore the SOLE exit from a compact pull-up, which
 * raises the stakes on every hide decision here - hiding the control on a surface whose drag does not
 * actually dismiss does not merely inconvenience the user, it TRAPS them. Verify the drag before hiding.
 *
 * AND THE DRAG IS NOT UNIVERSAL ANY MORE. On mobile a detail presents as a full PAGE on the shell's
 * overlay layer (`shell/detailPresentationPlatform`), which has no gorhom sheet, no grab handle and no
 * drag at all - so the whole premise of the HIDE branch evaporates and the hide would trap the user on
 * iOS, where there is no hardware back either. That is what `dismissGesture` is: the caller states
 * whether its surface HAS a dismiss gesture, and a surface that does not always gets a control. It
 * defaults to TRUE so every historic caller (the compact sheet header, the landscape panel, the report
 * wizard) keeps its exact behaviour.
 *
 * A PAGE NOW HAS AN EDGE SWIPE, AND `dismissGesture` STILL STAYS FALSE. `shell/PageStack.native` gives
 * every page an iOS-style interactive left-edge back swipe. That is deliberately NOT a `dismissGesture`
 * and must never be reported as one, on three counts: it exists on iOS ONLY (Android 10+ gesture nav owns
 * the left edge, so arming it there double-pops), it is invisible - trading the only VISIBLE exit for a
 * gesture with no affordance is undiscoverable and fails a11y outright, and it is not a dismissal but a
 * navigation. So the swipe is strictly ADDITIVE: `PageStack` keeps passing `dismissGesture: false`, and
 * it consults THIS module the other way round - `canSwipeBack` arms the gesture only where
 * `detailLeadingAffordance` already answers "back", which is what stops an edge flick silently discarding
 * a half-written event at the root of a flow (where the honest control is a close X).
 *
 * THE TWO SURVIVING ROOT CONTROLS are `create-cleanup` and `edit-cleanup` (the other flow kind,
 * `composer`, owns its own header - see SCOPE). Their collapse is a deliberate no-op to protect a
 * half-written event, so with the dock gone they would have no exit at all. `detailLeadingAffordance`
 * therefore keeps a control there but makes it a CLOSE X rather than a back chevron, because a root flow
 * has no parent to return to and the chevron was making exactly the promise this module exists to stop.
 *
 * SCOPE - deliberately NOT applied to the seven own-header FULL bodies (thread, pinned-messages,
 * new-group, new-channel, composer, post-thread, and - since P8 - person). Those render on the portrait
 * OVERLAY layer, which has NO drag gesture at all, and they COVER the list they were pushed from, so their
 * root-level Back is a real navigation back. They are structurally out of reach here anyway:
 * `titleForEntry` returns the " " suppression sentinel for all seven, so neither `SheetHeader` nor the
 * shell's overlay-layer header renders a `DetailBar` for them. Do not "tidy up" by routing ConvoBar /
 * PostThreadBody / NewGroupBody / NewChannelBody / PersonDetailBody through this predicate.
 *
 * The bodies CONVERTED from a sheet to a page keep no header of their own, so they DO come through here -
 * via the shell's overlay header, which passes `dismissGesture: false`. That is the whole point: the same
 * one gate answers for both presentations, and only the one input that genuinely differs is stated.
 */
import { isFlowKind, type DetailEntry } from "../nav"

export interface BackAffordanceInput {
  /** The live nav stack - the authority on "is there a parent entry to return to?". */
  stack: readonly DetailEntry[]
  /** The active layout mode (the nav store's `mode`, which AppShell keeps in sync with the breakpoint). */
  mode: "compact" | "expanded"
  /**
   * The surface's OWN wizard step index (0 = the first step). Only the bodies that host a multi-step flow
   * inside a single nav entry pass it (the report wizard); everything else omits it.
   */
  stepIndex?: number
  /**
   * Does the surface drawing this header have a DRAG-TO-DISMISS gesture? The compact pull-up does (the
   * grab handle), a full PAGE on the overlay layer does not. Defaults to TRUE - the historic assumption,
   * and the reason every existing caller may keep omitting it.
   *
   * It is the ONLY thing that makes the compact-root HIDE branch safe: that branch trades the control for
   * the drag, so on a surface with no drag it would leave zero exits (the dock is hidden over any detail,
   * and iOS has no hardware back).
   */
  dismissGesture?: boolean
}

export function showBackAffordance({
  stack,
  mode,
  stepIndex = 0,
  dismissGesture = true,
}: BackAffordanceInput): boolean {
  // A real destination always earns the chevron: an earlier wizard step, or a parent entry underneath.
  if (stepIndex > 0) return true
  if (stack.length > 1) return true
  // Landscape: the panel is persistent and has no dismiss gesture, so Back (to the feed / the list it was
  // opened from) is the only way out of it and must always be offered. LANDSCAPE DOES HAVE GLOBAL
  // NAVIGATION NOW - the vertical rail (shell/Rail) - but that is not a substitute for this chevron: the
  // rail calls `selectView`, which LEAVES for another surface and clears the stack; Back RETURNS to the
  // one underneath. Both exist, they mean different things, and only this one is a navigation back.
  if (mode === "expanded") return true
  // No drag to trade the control away for (a full page): the control is the sole exit, whatever the kind.
  // Sits ABOVE the compact-root branch precisely because that branch's whole justification is the drag.
  if (!dismissGesture) return true
  // Portrait at the root of the stack (or a bare tab root): Back would only close, and the grab-handle
  // drag already does that - except for the in-progress flows, whose collapse is a deliberate no-op, so
  // for them the drag is NOT an exit and something has to be (the dock is hidden under a sheet detail).
  const root = stack[0] // `DetailEntry | undefined` under noUncheckedIndexedAccess
  return root !== undefined && isFlowKind(root.kind)
}

/** What a detail header draws in its leading slot: navigation, an exit, or nothing at all. */
export type DetailLeadingAffordance = "back" | "close" | "none"

/**
 * WHICH leading control a detail header should draw: a back chevron, a close X, or nothing.
 *
 * A strict refinement of {@link showBackAffordance} - it calls it, so there is still exactly ONE gate and
 * the two can never disagree about whether a control appears. It only splits the "yes" case, on the same
 * question the module doc is about: does the control NAVIGATE (chevron) or merely CLOSE (X)?
 *
 * The branch ladder mirrors `showBackAffordance`'s line for line, which makes the punchline structural:
 * once a control is warranted, every rung except the last has a real destination, so the ONLY way to reach
 * "close" is the compact-root FLOW-kind escape hatch - a surface whose drag refuses to dismiss it and
 * which has nothing underneath. That is the one place the old chevron was lying.
 *
 * `mode === "expanded"` stays a CHEVRON on purpose even at the stack root, and even on an EMPTY stack. In
 * landscape there is no overlay to close: ExpandedShell is ONE persistent card that always shows something,
 * and home is the something it falls back to. Both root cases therefore have a real destination, by two
 * different mechanisms - which is why the rung is worth spelling out rather than reading as a catch-all:
 *
 *   - ONE entry     -> `back()` pops it and the card re-renders as the view root underneath (home = the
 *                      feed). ExpandedShell's own header hides its Home chip at this depth for exactly
 *                      this reason: "Back already returns to the home card".
 *   - EMPTY stack   -> a top-level VIEW is filling the card (the landscape report wizard at step 1, which
 *                      owns its header and passes `stepIndex`). Its Back is
 *                      `useNavStore.leaveReportFlow()`, i.e. the view + stack the wizard was launched
 *                      from, restored into the SAME card. Nothing is dismissed, the user is moved between
 *                      surfaces - a chevron.
 *
 * So do not "simplify" this to close-on-any-root, and do not narrow it to `stack.length === 1`: an X on
 * either would claim the landscape card can be closed, and it cannot be.
 *
 * THE PAGE ROOT (`dismissGesture: false`) is the one rung that does NOT mirror `showBackAffordance` in
 * order, and deliberately so: there the FLOW test runs FIRST. A root flow page is still a flow - nothing
 * behind it and a collapse that refuses - so it keeps its honest close X; every other page root gets a
 * chevron, because `back()` at depth 1 pops to the origin VIEW the store guarantees is underneath (the
 * second invariant in nav/useNavStore.ts), which is a real destination, not a dismissal.
 */
export function detailLeadingAffordance(input: BackAffordanceInput): DetailLeadingAffordance {
  if (!showBackAffordance(input)) return "none"
  const { stack, mode, stepIndex = 0 } = input
  if (stepIndex > 0) return "back" // an earlier wizard step
  if (stack.length > 1) return "back" // a parent entry underneath
  if (mode === "expanded") return "back" // the view root (home = the feed) underneath
  // At this rung the gate said YES on a compact root, which leaves exactly two producers: a FLOW kind (the
  // sheet case, unchanged) or a page with no drag. Test the flow first so a root flow PAGE keeps the X.
  const root = stack[0] // `DetailEntry | undefined` under noUncheckedIndexedAccess
  if (root !== undefined && isFlowKind(root.kind)) return "close"
  return "back" // a page root: no drag, but the view underneath is a genuine destination
}
