/**
 * PinnedBar (P3 Task 3.6): cyclic tap-to-jump over the room's pins (pinnedAt DESC). A tap jumps to
 * the ACTIVE pin via the P2 jump flow, THEN advances to the next older pin, wrapping to the newest
 * (nextPinIndex). The index clamps rather than resets when an unpin shrinks the list mid-cycle.
 */
import { useCallback, useEffect, useState } from "react"
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
  const pinIndex = pins.length > 0 ? Math.min(pinActiveIndex, pins.length - 1) : 0
  useEffect(() => {
    // Room switch restarts the cycle at the newest pin.
    setPinActiveIndex(0)
  }, [roomId, roomKind])
  const onPinBarTap = useCallback(() => {
    const target = pins[pinIndex]
    if (!target) return
    onJumpToMessage(target.id)
    setPinActiveIndex(nextPinIndex(pinIndex, pins.length))
  }, [pins, pinIndex, onJumpToMessage])
  return { pinIndex, onPinBarTap }
}
