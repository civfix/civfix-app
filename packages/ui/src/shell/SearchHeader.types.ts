/**
 * Shared contract for the sheet SearchHeader seam (stage 3C-1).
 *
 * SearchHeader is the sheet's list-mode header (design `.pi-search` + `.pi-avatar`): a glass search
 * field (flex) + an optional 32px profile avatar. Its implementation is platform-split because the
 * INPUT differs:
 *   - `.native` uses gorhom's `BottomSheetTextInput`, so typing inside the sheet does not fight the
 *     drag gesture.
 *   - `.web` uses a plain react-native `TextInput` (the CompactShell.web drag is a PanResponder on the
 *     grab handle only, so the input never competes with it) and must stay free of @gorhom/bottom-sheet.
 *
 * Both seams share these props + the same flex-row layout, so the package emits ONE SearchHeader.d.ts.
 *
 * The avatar/profile affordance is OPTIONAL: the unified CompactShell drives only the search field off
 * the nav store (value/placeholder/mode/focus); a host can later wire the user + `onOpenProfile` (stage
 * 4). When `userName` is omitted the row is just the search field - matching the 3B placeholder.
 */
import type { LucideIcon } from "../typography"

export interface SearchHeaderProps {
  /** The current search query (CompactShell passes the nav store's `query`). */
  value: string
  /** Context-aware placeholder ("Search places & events" / "Search people" / "Search your reports"). */
  placeholder: string
  /** "people" mode swaps the trailing mic glyph for a people glyph (design SearchHeader). */
  mode: "places" | "people" | "reports"
  onChangeText: (text: string) => void
  /** Focusing the field expands the sheet to full (CompactShell wires this to setSnap(2)). */
  onFocus: () => void

  /** Profile name for the trailing avatar. When omitted the avatar is not rendered (3B parity). */
  userName?: string
  /** Real profile photo URL (provider avatar); falls back to the monogram. */
  userPhotoUrl?: string | null
  /** Open the profile (avatar tap). Only meaningful when `userName` is set. */
  onOpenProfile?: () => void
  /**
   * Signed-out sign-in affordance. When set, the trailing slot renders a sign-in icon (instead of the
   * avatar) that opens auth DIRECTLY - replacing the old "You" monogram that opened a profile containing
   * nothing but a sign-in button. Takes priority over `userName`, so the host passes one or the other.
   */
  onSignIn?: () => void

  /**
   * Feed-first redesign (P3): the Apple-Music DOCKED variant. When true the header renders as a
   * bottom-docked search bar (design §3.2) - a leading coral Home circle, the search pill, and a trailing
   * ✕ clear - that RISES above the keyboard on focus (native: reanimated withTiming translateY; web: CSS
   * translateY driven by the visual-viewport keyboard inset, with the same iOS instant-guard the sheet
   * uses). Default false keeps the historic in-sheet top-header behavior for every other view unchanged.
   *
   * Mounted by the search surface (P4 SearchBody) at the bottom of the search page; P3 delivers the
   * capability + affordances.
   */
  docked?: boolean
  /** Docked-only: the leading round exit button - returns to the view Search was opened from. */
  onHome?: () => void
  /**
   * Docked-only (liquid-glass redesign, Task 2): the glyph shown in the leading exit button. The dock
   * morph collapses the 4 tabs into this one 58px glass button showing the PREVIOUS view's icon (coral),
   * so tapping it reads as "go back to where I was". Defaults to Home when the host omits it (the plain
   * pre-morph docked search bar). Typed as the shared `LucideIcon` (a lucide-react-native component).
   */
  exitIcon?: LucideIcon
  /** Docked-only: the trailing ✕ - clears the query (and/or dismisses the search field). */
  onClear?: () => void
}
