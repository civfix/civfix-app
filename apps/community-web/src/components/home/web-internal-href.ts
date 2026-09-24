import { useNavStore } from "@civfix/ui"
import type { OpenInternalHrefCapability } from "@civfix/ui/capabilities"

import { entryFromWebPath } from "./nav-history"

export const webOpenInternalHref: OpenInternalHrefCapability = {
  entryFor: entryFromWebPath,
  open: (path: string): boolean => {
    const entry = entryFromWebPath(path)
    if (!entry) return false
    useNavStore.getState().push(entry)
    return true
  },
}
