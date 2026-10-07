/**
 * Props shared by both SearchHeader seams, so the package emits one SearchHeader.d.ts. The input differs:
 * native uses gorhom's `BottomSheetTextInput` so typing inside the sheet does not fight the drag gesture;
 * web uses a plain TextInput (the web sheet drag is bound to the grab handle only) and must stay free of
 * @gorhom/bottom-sheet.
 */

export interface SearchHeaderProps {
  value: string
  placeholder: string
  /** "people" swaps the trailing mic glyph for a people glyph. */
  mode: "places" | "people" | "reports"
  onChangeText: (text: string) => void
  onFocus: () => void

  /** The avatar renders only when set. */
  userName?: string
  /** Falls back to the monogram. */
  userPhotoUrl?: string | null
  onOpenProfile?: () => void
  /** When set, the trailing slot is a sign-in icon that opens auth directly; takes priority over `userName`. */
  onSignIn?: () => void

  /**
   * Renders the bottom-docked search bar (leading exit circle, search pill, trailing clear button) that
   * rises above the keyboard on focus, instead of the in-sheet top header.
   */
  docked?: boolean
  /** Docked-only: returns to the view Search was opened from. */
  onHome?: () => void
  /** Docked-only: the trailing clear button. */
  onClear?: () => void
}
