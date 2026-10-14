import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { mergeChatItems, type ChatItem, type RoomKind } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { restoreLocalChatAttachments } from "../localChatAttachments"
import { roomEndpoints } from "./chatRoom"

export interface ChatAroundDeps {
  api: ApiClient
  roomId: string
  roomKind: RoomKind
  myUserId: string | null
  setAroundWindow: Dispatch<SetStateAction<ChatItem[] | null>>
}

/** The jump-to-message window: a page centred on one message, shown instead of the newest history. */
export function useChatAroundWindow({ api, roomId, roomKind, myUserId, setAroundWindow }: ChatAroundDeps) {
  const [aroundLoading, setAroundLoading] = useState(false)
  const aroundSeqRef = useRef(0)

  const fetchAround = useCallback(
    (messageId: string) => {
      const seq = ++aroundSeqRef.current
      setAroundLoading(true)
      return roomEndpoints(api, roomKind, roomId)
        .page({ around: messageId })
        .then((page) => {
          if (seq !== aroundSeqRef.current) return true
          const items = page.items.filter((m) => m.cleanupId === roomId)
          setAroundWindow(restoreLocalChatAttachments(mergeChatItems(items, [], [], myUserId)))
          setAroundLoading(false)
          return true
        })
        .catch(() => {
          if (seq !== aroundSeqRef.current) return true
          setAroundLoading(false)
          return false
        })
    },
    [api, roomKind, roomId, myUserId, setAroundWindow],
  )

  const clearAround = useCallback(() => {
    aroundSeqRef.current++
    setAroundWindow(null)
    setAroundLoading(false)
  }, [setAroundWindow])

  return { aroundLoading, fetchAround, clearAround }
}
