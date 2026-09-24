import React, { useRef } from "react"
import { View } from "react-native"
import { useLayoutMode } from "../theme"
import { Text } from "../typography"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useSearchBarStore } from "../shell/searchBarStore"
import { useT } from "../i18n"
import { SearchResults } from "./SearchResults"
import { useSearchRecentStore } from "./searchRecentStore"
import {
  isSearchBodyFrozen,
  resolveSearchSurfaceState,
  searchSurfaceState,
} from "./searchSurfaceModel"
import { Discovery } from "./search/Discovery"
import { ExpandedSearchField } from "./search/ExpandedSearchField"
import { RecentlySearched } from "./search/RecentlySearched"
import { useRecordSearchOnCommit } from "./search/useRecordSearchOnCommit"
import { useSearchStyles } from "./search/searchStyles"

export function SearchBody() {
  const styles = useSearchStyles()
  const rawQuery = useNavStore((state) => state.query)
  const query = rawQuery.trim()

  const view = useNavStore((state) => state.view)
  const pinned = useSearchBarStore((state) => state.pinned)
  useRecordSearchOnCommit(query, pinned)
  const exitSettled = useSearchBarStore((state) => state.searchExitSettled)
  const frozen = isSearchBodyFrozen(view, exitSettled)
  const live = searchSurfaceState(query, pinned)
  const heldRef = useRef(live)
  if (!frozen) heldRef.current = live
  const held = resolveSearchSurfaceState(live, heldRef.current, frozen)

  const expanded = useLayoutMode() === "expanded"
  const surface =
    held.surface === "results" ? (
      <SearchResults query={held.query} />
    ) : (
      <SearchResting surface={held.surface} expanded={expanded} />
    )

  if (!expanded) return surface
  return (
    <View style={styles.expandedRoot}>
      <ExpandedSearchHeader />
      {surface}
    </View>
  )
}

function ExpandedSearchHeader() {
  const styles = useSearchStyles()
  const { t } = useT("home-sidebar")
  return (
    <View style={styles.expandedHead}>
      <View style={styles.tabRootRow}>
        <Text accessibilityRole="header" style={[styles.title, styles.titleTabRoot]}>
          {t("search_page.title")}
        </Text>
      </View>
      <ExpandedSearchField />
    </View>
  )
}

function SearchResting({
  surface,
  expanded,
}: {
  surface: "recents" | "discovery"
  expanded: boolean
}) {
  const styles = useSearchStyles()
  const { ScrollView } = useScrollHost()

  const recentCount = useSearchRecentStore((state) => state.recent.length)
  const showRecents = surface === "recents" && (!expanded || recentCount > 0)
  const showDiscovery = surface === "discovery" || expanded

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showRecents ? <RecentlySearched /> : null}
      {showRecents && showDiscovery ? <View style={styles.surfaceBreak} /> : null}
      {showDiscovery ? <Discovery expanded={expanded} /> : null}
      <View style={styles.bottomPad} />
    </ScrollView>
  )
}
