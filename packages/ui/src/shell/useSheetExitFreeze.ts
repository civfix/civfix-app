import { useRef } from "react"
import type { DetailEntry, View as NavView } from "../nav"

export interface SheetNavFrame {
  active: DetailEntry | null
  view: NavView
  stack: readonly DetailEntry[]
}

/**
 * On dismiss the store drops the detail synchronously while the sheet is still sliding off, so rendering
 * the live store would flash the underlying view's header and body on the dismissing card. While
 * `closing`, this returns the last live detail, view and stack instead. The stack is frozen too because
 * the header's back chevron reads it and would otherwise pop off the sliding card.
 */
export function useSheetExitFreeze(closing: boolean, live: SheetNavFrame): SheetNavFrame {
  const frozenEntryRef = useRef<DetailEntry | null>(live.active)
  const frozenViewRef = useRef<NavView>(live.view)
  const frozenStackRef = useRef<readonly DetailEntry[]>(live.stack)
  if (!closing) {
    frozenEntryRef.current = live.active
    frozenViewRef.current = live.view
    frozenStackRef.current = live.stack
  }
  return closing
    ? { active: frozenEntryRef.current, view: frozenViewRef.current, stack: frozenStackRef.current }
    : live
}
