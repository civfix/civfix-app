"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import * as React from "react"
import type { ReactNode } from "react"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"

import { TIGHT_ROW_PAD_Y } from "../row-density"
import { LoadingState, Skeleton } from "../states"
import { useIsNarrow } from "../use-media-query"
import type { SelectionApi } from "./use-selection"

const NOOP = () => {}
const CELL_PAD = `px-token-3 ${TIGHT_ROW_PAD_Y}`

function useScrollShadow<E extends HTMLElement>() {
  const ref = React.useRef<E>(null)
  const [edges, setEdges] = React.useState({ left: false, right: false })
  const update = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setEdges({ left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 })
  }, [])
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener("scroll", update, { passive: true })
    if (typeof ResizeObserver === "undefined") {
      return () => el.removeEventListener("scroll", update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", update)
    }
  }, [update])
  return { ref, edges, update }
}

export interface DataTableColumn<T> {
  id: string
  label: string
  render: (row: T) => ReactNode
  width?: string
  align?: "left" | "right"
  sortable?: boolean
  columnPriority?: number
}

export interface SortState {
  columnId: string
  dir: "asc" | "desc"
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  caption: string
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
  selection?: SelectionApi
  rowSelectLabel?: (row: T) => string
  onRowPress?: (row: T) => void
  rowPressLabel?: (row: T) => string
  cursorId?: string | null
  loading?: boolean
  skeletonRows?: number
  maxColumnPriority?: number
  renderCard?: (row: T) => ReactNode
  emptyState?: ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  sort,
  onSortChange,
  selection,
  rowSelectLabel,
  onRowPress,
  rowPressLabel,
  cursorId,
  loading,
  skeletonRows = 10,
  maxColumnPriority,
  renderCard,
  emptyState,
  className,
}: DataTableProps<T>) {
  const { t } = useT("host-common")
  const narrow = useIsNarrow()
  const { ref: scrollRef, edges, update: updateShadow } = useScrollShadow<HTMLDivElement>()

  const visibleColumns = React.useMemo(
    () =>
      maxColumnPriority === undefined
        ? columns
        : columns.filter((c) => (c.columnPriority ?? 0) <= maxColumnPriority),
    [columns, maxColumnPriority],
  )

  React.useEffect(() => {
    updateShadow()
  }, [rows, visibleColumns, loading, updateShadow])

  if (narrow && renderCard) {
    if (loading) {
      return <LoadingState shape="card" count={Math.min(skeletonRows, 6)} className={className} />
    }
    if (rows.length === 0) return <div className={className}>{emptyState}</div>
    return (
      <ul className={cn("flex list-none flex-col gap-token-2", className)}>
        {rows.map((row) => (
          <li key={rowKey(row)}>{renderCard(row)}</li>
        ))}
      </ul>
    )
  }

  const colCount = visibleColumns.length + (selection ? 1 : 0)

  return (
    <div
      className={cn(
        "relative rounded-md border border-console-line bg-console-surface shadow-console-1",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-px left-px z-20 w-6 rounded-l-md bg-gradient-to-r from-console-surface to-transparent transition-opacity duration-d1",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-px right-px z-20 w-6 rounded-r-md bg-gradient-to-l from-console-surface to-transparent transition-opacity duration-d1",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
      <p role="status" className="sr-only">
        {loading ? t("state.loading") : null}
      </p>
      <div ref={scrollRef} className="overflow-x-auto rounded-md">
        <table aria-busy={loading || undefined} className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-console-line bg-console-tint">
              {selection ? (
                <th scope="col" className="w-10 px-token-3 py-token-2">
                  <input
                    type="checkbox"
                    aria-label={t("table.select_all")}
                    checked={selection.allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selection.someSelected
                    }}
                    onChange={() => selection.toggleAll()}
                    className="h-4 w-4 accent-console-accent"
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                const active = sort?.columnId === column.id
                const SortIcon = active ? (sort?.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      column.sortable && onSortChange
                        ? active
                          ? sort?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "whitespace-nowrap px-token-3 py-token-2 text-token-12 font-bold uppercase tracking-wider text-console-ink-3",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange({
                            columnId: column.id,
                            dir: active && sort?.dir === "asc" ? "desc" : "asc",
                          })
                        }
                        title={t("table.sort_by", { column: column.label })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-xs uppercase tracking-wider hover:text-console-ink focus-visible:outline-none focus-visible:shadow-console-ring",
                          active && "text-console-ink",
                        )}
                      >
                        {column.label}
                        <SortIcon aria-hidden className="h-3 w-3" />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="border-b border-console-line last:border-b-0">
                    {selection ? (
                      <td className={CELL_PAD}>
                        <Skeleton shape="text" className="h-4 w-4" />
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td key={column.id} className={CELL_PAD}>
                        <Skeleton shape="text" className="max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = rowKey(row)
                  const selected = selection?.isSelected(id) ?? false
                  const isCursor = cursorId === id
                  return (
                    <tr
                      key={id}
                      onClick={onRowPress ? () => onRowPress(row) : undefined}
                      className={cn(
                        "relative border-b border-console-line transition-colors duration-d1 last:border-b-0",
                        onRowPress && "cursor-pointer hover:bg-console-surface-alt/60",
                        isCursor && "bg-console-surface-alt",
                        selected && "shadow-[inset_3px_0_0_var(--console-accent)]",
                      )}
                    >
                      {selection ? (
                        <td className={CELL_PAD}>
                          <input
                            type="checkbox"
                            aria-label={rowSelectLabel?.(row) ?? t("table.select_row")}
                            checked={selected}
                            onChange={NOOP}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (event.shiftKey) selection.selectRange(id)
                              else selection.toggle(id)
                            }}
                            className="h-4 w-4 accent-console-accent"
                          />
                        </td>
                      ) : null}
                      {visibleColumns.map((column, columnIndex) => {
                        const content = column.render(row)
                        const primary = onRowPress && columnIndex === 0
                        return (
                          <td
                            key={column.id}
                            className={cn(
                              CELL_PAD,
                              "text-token-13 text-console-ink-2 [font-feature-settings:'tnum']",
                              column.align === "right" && "text-right",
                            )}
                          >
                            {primary ? (
                              <button
                                type="button"
                                aria-label={rowPressLabel?.(row)}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onRowPress(row)
                                }}
                                className="w-full rounded-xs text-left focus-visible:outline-none focus-visible:shadow-console-ring"
                              >
                                {content}
                              </button>
                            ) : (
                              content
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-token-4 py-token-6">
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
