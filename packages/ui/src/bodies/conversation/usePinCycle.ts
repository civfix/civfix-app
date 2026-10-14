/**
 * PinnedBar's cyclic tap-to-jump over the room's pins (pinnedAt DESC). A tap jumps to the ACTIVE pin
 * via the jump flow, THEN advances to the next older pin, wrapping to the newest
 * (nextPinIndex). The index clamps rather than resets when an unpin shrinks the list mid-cycle.
 */
import { useCallback, useState } from "react"
import type { ChatMessageDTO, RoomKind } from "@civfix/shared"
import { nextPinIndex } from "../pinCycle"

export function usePinCycle({
  pins,
  roomId,
  roomKind,
  onJumpToMessage,
}: {
  pins: ChatMessageDTO[]
  roomId: string
  roomKind: RoomKind
  onJumpToMessage: (messageId: string) => void
}): { pinIndex: number; onPinBarTap: () => void } {
  const [pinActiveIndex, setPinActiveIndex] = useState(0)
  // A room switch restarts the cycle at the newest pin. Adjusted while rendering, not in an effect, so the
  // new room's bar never paints the previous room's position for a frame.
  const roomKey = `${roomKind}:${roomId}`
  const [cycleRoom, setCycleRoom] = useState(roomKey)
  if (cycleRoom !== roomKey) {
    setCycleRoom(roomKey)
    setPinActiveIndex(0)
  }
  const pinIndex = pins.length > 0 ? Math.min(pinActiveIndex, pins.length - 1) : 0
  const onPinBarTap = useCallback(() => {
    const target = pins[pinIndex]
    if (!target) return
    onJumpToMessage(target.id)
    setPinActiveIndex(nextPinIndex(pinIndex, pins.length))
  }, [pins, pinIndex, onJumpToMessage])
  return { pinIndex, onPinBarTap }
}
