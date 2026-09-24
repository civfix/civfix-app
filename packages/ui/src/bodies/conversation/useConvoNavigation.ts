import { useCallback } from "react"
import type { PersonDTO, RoomKind } from "@civfix/shared"
import { useNavStore } from "../../nav"
import { openGroupInfo, openPinnedMessages } from "../navHelpers"

export function useConvoNavigation({
  id,
  roomKind,
  peer,
  peerId,
  fullScreen,
  closeMenu,
  onOpenProfile,
  onOpenMembers,
  onOpenGroupInfo,
  onViewReport,
  onOpenPinnedList,
  onJumpFromPinned,
}: {
  id: string
  roomKind: RoomKind
  peer?: PersonDTO
  peerId?: string
  fullScreen: boolean
  closeMenu: () => void
  onOpenProfile?: (peerId: string) => void
  onOpenMembers?: () => void
  onOpenGroupInfo?: () => void
  onViewReport?: () => void
  onOpenPinnedList?: () => void
  onJumpFromPinned?: (messageId: string) => void
}) {
  const openProfile = useCallback(() => {
    closeMenu()
    if (!peerId) return
    if (onOpenProfile) onOpenProfile(peerId)
    else useNavStore.getState().push({ kind: "person", id: peer && peer.id === peerId ? (peer.handle ?? peerId) : peerId })
  }, [closeMenu, peerId, onOpenProfile, peer])

  const onMembers = useCallback(() => {
    if (onOpenMembers) onOpenMembers()
    else if (!fullScreen) useNavStore.getState().push({ kind: "members", id, roomKind })
  }, [onOpenMembers, fullScreen, id, roomKind])

  const viewReport = useCallback(() => {
    closeMenu()
    if (onViewReport) onViewReport()
    else if (!fullScreen) useNavStore.getState().push({ kind: "pin", id })
  }, [closeMenu, onViewReport, fullScreen, id])

  const onGroupInfo = useCallback(() => {
    if (onOpenGroupInfo) onOpenGroupInfo()
    else if (!fullScreen) openGroupInfo(id)
  }, [onOpenGroupInfo, fullScreen, id])

  const onOpenPinList = useCallback(() => {
    if (onOpenPinnedList) onOpenPinnedList()
    else if (!fullScreen) openPinnedMessages(id, roomKind)
  }, [onOpenPinnedList, fullScreen, id, roomKind])

  const jumpFromPinned = useCallback(
    (messageId: string) => {
      if (onJumpFromPinned) {
        onJumpFromPinned(messageId)
        return
      }
      const nav = useNavStore.getState()
      const stack = nav.stack
      const below = stack.length >= 2 ? stack[stack.length - 2] : undefined
      if (below && below.kind === "thread" && below.id === id) {
        nav.setStack([...stack.slice(0, stack.length - 2), { ...below, jumpToMessageId: messageId }])
      } else {
        nav.setStack([
          ...stack.slice(0, Math.max(0, stack.length - 1)),
          { kind: "thread", id, roomKind, jumpToMessageId: messageId },
        ])
      }
    },
    [onJumpFromPinned, id, roomKind],
  )

  const onOpenPerson = useCallback(
    (target: { id: string; handle?: string | null; deleted?: boolean }) => {
      if (target.deleted) return
      if (onOpenProfile) onOpenProfile(target.id)
      else useNavStore.getState().push({ kind: "person", id: target.handle ?? target.id })
    },
    [onOpenProfile],
  )

  return { openProfile, onMembers, viewReport, onGroupInfo, onOpenPinList, jumpFromPinned, onOpenPerson }
}
