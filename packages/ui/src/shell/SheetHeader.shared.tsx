import React from "react"
import { useNavStore, searchModeFor, titleForEntry, titleParamsForEntry, type DetailEntry, type View as NavView } from "../nav"
import { useAuthState, useRequireAuth } from "../data"
import { useT } from "../i18n"
import { DetailBar } from "./DetailBar"
import { detailLeadingAffordance } from "./backAffordance"
import { detailTrailingActionFor } from "./detailTrailingAction"
import { headerAuthAffordance } from "./headerAuthAffordance"
import { compactBottomChrome } from "./tabBarLogic"
import type { SearchHeaderProps } from "./SearchHeader.types"

export interface SheetHeaderProps {
  view: NavView
  active: DetailEntry | null
  stack?: readonly DetailEntry[]
  SearchHeaderComponent: React.ComponentType<SearchHeaderProps>
  onSearchFocus: () => void
}

export interface DetailHeaderProps {
  active: DetailEntry | null
  stack?: readonly DetailEntry[]
  dismissGesture?: boolean
}

export function hasDetailHeader(active: DetailEntry | null): boolean {
  return titleForEntry(active).trim() !== ""
}

export function DetailHeader({ active, stack, dismissGesture }: DetailHeaderProps) {
  const back = useNavStore((s) => s.back)
  const liveStack = useNavStore((s) => s.stack)
  const { t } = useT("nav")
  const titleKey = titleForEntry(active)
  const leading = detailLeadingAffordance({ stack: stack ?? liveStack, mode: "compact", dismissGesture })
  return hasDetailHeader(active) ? (
    <DetailBar
      title={t(titleKey, titleParamsForEntry(active))}
      onBack={back}
      showBack={leading !== "none"}
      leading={leading === "close" ? "close" : "back"}
      trailingAction={detailTrailingActionFor(active)}
    />
  ) : null
}

export function SheetHeader({ view, active, stack, SearchHeaderComponent, onSearchFocus }: SheetHeaderProps) {
  const query = useNavStore((s) => s.query)
  const setQuery = useNavStore((s) => s.setQuery)
  const { user, isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const { t } = useT("nav")

  const spec = searchModeFor(view, active)
  if (spec.mode === "detail") return <DetailHeader active={active} stack={stack} />
  const signedOut = headerAuthAffordance({ isAuthenticated, isPending }) === "sign-in"
  if (compactBottomChrome(view) === "docked-search") return null
  return (
    <SearchHeaderComponent
      value={query}
      placeholder={t(spec.placeholder)}
      mode={spec.kind}
      onChangeText={setQuery}
      onFocus={onSearchFocus}
      userName={signedOut ? undefined : user?.displayName ?? t("fallback_you")}
      userPhotoUrl={user?.avatarUrl ?? undefined}
      onOpenProfile={() => useNavStore.getState().push({ kind: "profile" })}
      onSignIn={signedOut ? () => requireAuth(() => useNavStore.getState().push({ kind: "profile" })) : undefined}
    />
  )
}
