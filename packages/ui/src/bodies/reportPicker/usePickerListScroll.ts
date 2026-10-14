import { useCallback, useRef } from "react"
import type { LayoutChangeEvent } from "react-native"
import type { ScrollHostListHandle } from "../../shell/ScrollHost"
import { rowIndexOf, rowOffset, type PickerListItem } from "./reportPickerModel"

const ROW_REVEAL_INSET = 72

export function usePickerListScroll(allItems: readonly PickerListItem[], revealRow: (id: string) => void) {
  const listRef = useRef<ScrollHostListHandle>(null)
  const heightsRef = useRef<Map<string, number>>(new Map())

  const scrollToRow = useCallback(
    (id: string) => {
      const index = rowIndexOf(allItems, id)
      if (index < 0) return
      revealRow(id)
      const offset = rowOffset(allItems, index, heightsRef.current)
      listRef.current?.scrollToOffset?.({ offset: Math.max(0, offset - ROW_REVEAL_INSET), animated: true })
    },
    [allItems, revealRow],
  )

  const onItemLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    heightsRef.current.set(key, event.nativeEvent.layout.height)
  }, [])

  return { listRef, scrollToRow, onItemLayout }
}
