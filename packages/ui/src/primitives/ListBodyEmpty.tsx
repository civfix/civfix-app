import React from "react"
import { useTheme } from "../theme"
import { iconMap, type LucideIcon } from "../typography"
import { EmptyState, LoadingState } from "./StateView"
import type { SkeletonRowKind } from "./skeleton"

export type ListBodyPhase = "loading" | "error" | "noMatch" | "empty"

export interface ListBodyCopy {
  title: string
  body: string
}

export interface ListBodyCopies {
  error: ListBodyCopy
  noMatch: ListBodyCopy
  empty: ListBodyCopy & { icon: LucideIcon }
}

export type ListBodyEmptyCopy<P extends ListBodyPhase> = Pick<ListBodyCopies, Exclude<P, "loading">>

export interface ListBodyEmptyProps<P extends ListBodyPhase> {
  phase: P
  copy: ListBodyEmptyCopy<P>
  skeleton?: SkeletonRowKind
  skeletonRows?: number
}

const ERROR_ICON_SIZE = 30

export function ListBodyEmpty<P extends ListBodyPhase>({
  phase,
  copy,
  skeleton,
  skeletonRows,
}: ListBodyEmptyProps<P>) {
  const th = useTheme()
  const copies = copy as Partial<ListBodyCopies>
  if (phase === "loading") {
    return skeleton ? (
      <LoadingState skeleton={skeleton} rows={skeletonRows} />
    ) : (
      <LoadingState variant="detail" />
    )
  }
  if (phase === "error" && copies.error) {
    return (
      <EmptyState
        variant="detail"
        tone="neutral"
        icon={iconMap.CloudOff}
        iconColor={th.colors.textSubtle}
        iconSize={ERROR_ICON_SIZE}
        title={copies.error.title}
        body={copies.error.body}
      />
    )
  }
  if (phase === "noMatch" && copies.noMatch) {
    return (
      <EmptyState
        variant="detail"
        icon={iconMap.Search}
        title={copies.noMatch.title}
        body={copies.noMatch.body}
      />
    )
  }
  if (phase === "empty" && copies.empty) {
    return (
      <EmptyState
        variant="detail"
        icon={copies.empty.icon}
        title={copies.empty.title}
        body={copies.empty.body}
      />
    )
  }
  return null
}
