/**
 * A no-op: on web Search is a normal base body with no dock morph to sync to, and `SEARCH_IS_OVERLAY` is
 * false, so the base surface still renders it.
 */
import type { ReactElement } from "react"
import type { SearchBodyRevealProps } from "./SearchBodyReveal.types"

export function SearchBodyReveal(_props: SearchBodyRevealProps): ReactElement | null {
  return null
}
