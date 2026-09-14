import { createContext, useContext } from "react"
import { shareLink } from "../primitives/share"
import type { SharePostHandle, SharePostTarget } from "./types"

export const SharePostContext = createContext<SharePostHandle | null>(null)
SharePostContext.displayName = "SharePostContext"

const DIRECT_SHARE: SharePostHandle = {
  open: (target: SharePostTarget) => {
    void shareLink({ title: target.title, path: target.path })
  },
}

export function useSharePost(): SharePostHandle {
  return useContext(SharePostContext) ?? DIRECT_SHARE
}
