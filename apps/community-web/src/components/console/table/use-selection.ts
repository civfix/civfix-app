"use client"

import { useCallback, useMemo, useState } from "react"

export interface SelectionApi {
  selectedIds: ReadonlySet<string>
  count: number
  allSelected: boolean
  someSelected: boolean
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  selectAll: () => void
  clear: () => void
  cursorId: string | null
  setCursor: (id: string | null) => void
  selectRange: (toId: string) => void
}

export function useSelection(orderedIds: readonly string[]): SelectionApi {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [cursorId, setCursor] = useState<string | null>(null)

  const visible = useMemo(() => new Set(orderedIds), [orderedIds])
  const visibleSelectedCount = useMemo(() => {
    let n = 0
    for (const id of selectedIds) if (visible.has(id)) n += 1
    return n
  }, [selectedIds, visible])

  const allSelected = orderedIds.length > 0 && visibleSelectedCount === orderedIds.length

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setCursor(id)
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds))
  }, [orderedIds])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      let selectedVisible = 0
      for (const id of prev) if (visible.has(id)) selectedVisible += 1
      if (orderedIds.length > 0 && selectedVisible === orderedIds.length) return new Set()
      return new Set(orderedIds)
    })
  }, [orderedIds, visible])

  const selectRange = useCallback(
    (toId: string) => {
      const from = cursorId ? orderedIds.indexOf(cursorId) : -1
      const to = orderedIds.indexOf(toId)
      if (to === -1) return
      const start = from === -1 ? to : Math.min(from, to)
      const end = from === -1 ? to : Math.max(from, to)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (let i = start; i <= end; i += 1) {
          const id = orderedIds[i]
          if (id !== undefined) next.add(id)
        }
        return next
      })
      setCursor(toId)
    },
    [cursorId, orderedIds],
  )

  return {
    selectedIds,
    count: selectedIds.size,
    allSelected,
    someSelected: selectedIds.size > 0 && !allSelected,
    isSelected: (id) => selectedIds.has(id),
    toggle,
    toggleAll,
    selectAll,
    clear,
    cursorId,
    setCursor,
    selectRange,
  }
}
