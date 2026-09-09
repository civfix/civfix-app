/**
 * SearchBodyReveal (web seam) - a no-op.
 *
 * On web, Search is a normal base body (there is no dock morph over a map to sync to), so the reveal
 * overlay renders nothing and the base surface shows the Search body as before. `SEARCH_IS_OVERLAY` is
 * false on web, so PortraitShellFrame's `effectiveBaseView` is identity and the base still renders Search.
 */
import type { ReactElement } from "react"
import type { SearchBodyRevealProps } from "./SearchBodyReveal.types"

export function SearchBodyReveal(_props: SearchBodyRevealProps): ReactElement | null {
  return null
}
