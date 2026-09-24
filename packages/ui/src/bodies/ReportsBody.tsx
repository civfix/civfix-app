import { useCallback, useEffect, useMemo, useState } from "react"
import { View, ActivityIndicator } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, useLayoutMode, headingLevel } from "../theme"
import { Text, iconMap } from "../typography"
import {
  ListBodyEmpty,
  ListSearchField,
  SignInPrompt,
  useListBodyStyles,
  useListEndReached,
} from "../primitives"
import { useMyReports, useAuthState, useRequireAuth } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { idKeyExtractor } from "../primitives/listKeys"
import { ReportRowView } from "./ReportRow"
import { useListTimeAgo } from "./useListTimeAgo"
import { latestNote, matchesReportQuery, reportThumbUrl, searchBackfill } from "./reportsListModel"
import { useT } from "../i18n"

const LIST_SKELETON_ROWS = 7
const SEARCH_SKELETON_ROWS = 3

export function ReportsBody() {
  const styles = useStyles()
  const listStyles = useListBodyStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
  const { t } = useT("report-list")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const query = useMyReports()
  const layout = useLayoutMode()
  const atViewRoot = useNavStore((s) => s.stack.length === 0)
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()

  const all = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data?.pages],
  )
  const filtering = q.length > 0
  const reports = useMemo(
    () =>
      !filtering
        ? all
        : all.filter((r) => matchesReportQuery(r, t(`enums:category.${r.category}`), q)),
    [all, filtering, q, t],
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const backfill = searchBackfill({
    filtering,
    pagesLoaded: query.data?.pages.length ?? 0,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPageFailed: query.isFetchNextPageError,
  })
  useEffect(() => {
    if (backfill === "fetch") void fetchNextPage()
  }, [backfill, fetchNextPage])
  const onEndReached = useListEndReached(query, filtering)
  const showSearch = layout === "expanded" && all.length > 0
  const showTitle = layout === "compact" ? reports.length > 0 : atViewRoot

  const timeAgo = useListTimeAgo()
  const renderItem = useCallback(
    ({ item }: { item: ReportDTO }) => (
      <ReportRowView
        id={item.id}
        category={item.category}
        status={item.status}
        title={item.title?.trim() || t(`enums:category.${item.category}`)}
        lat={item.lat}
        lng={item.lng}
        thumbUrl={reportThumbUrl(item)}
        subtitle={item.addr ?? null}
        when={timeAgo(item.createdAt)}
        note={latestNote(item) ?? null}
      />
    ),
    [t, timeAgo],
  )

  const signedOut = !isAuthenticated && !isPending
  const listLoading = isPending || query.isLoading
  const searchLoading = !!q && (backfill === "fetch" || backfill === "busy")
  const phase =
    listLoading || searchLoading ? "loading" : q ? "noMatch" : query.isError ? "error" : "empty"

  return (
    <FlatList
      data={signedOut ? [] : reports}
      keyExtractor={idKeyExtractor}
      style={listStyles.list}
      contentContainerStyle={
        signedOut || reports.length === 0 ? listStyles.listEmpty : listStyles.listContent
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <>
          {showTitle ? <ReportsHeader expanded={layout === "expanded"} /> : null}
          {showSearch ? (
            <ListSearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t("search.placeholder")}
              a11yLabel={t("search.a11y")}
              clearA11yLabel={t("search.clear_a11y")}
            />
          ) : null}
        </>
      }
      renderItem={renderItem}
      ListEmptyComponent={
        signedOut ? (
          <SignInPrompt
            icon={iconMap.MapPin}
            variant="detail"
            title={t("signin.title")}
            body={t("signin.body")}
            onSignIn={() => requireAuth(() => {}, { next: "/reports" })}
          />
        ) : (
          <ListBodyEmpty
            phase={phase}
            skeleton="report"
            skeletonRows={listLoading ? LIST_SKELETON_ROWS : SEARCH_SKELETON_ROWS}
            copy={{
              noMatch: {
                title: t("empty.no_match.title"),
                body: t("empty.no_match.body", { query: search.trim() }),
              },
              error: { title: t("error.title"), body: t("error.body") },
              empty: {
                icon: iconMap.MapPin,
                title: t("empty.none.title"),
                body: t("empty.none.body"),
              },
            }}
          />
        )
      }
      ListFooterComponent={
        reports.length > 0 && isFetchingNextPage ? (
          <View style={listStyles.footer}>
            <ActivityIndicator size="small" color={th.colors.textSubtle} />
          </View>
        ) : backfill === "partial" ? (
          <Text variant="caption" color={th.colors.textSubtle} style={styles.partialHint}>
            {t("search.partial", { count: all.length })}
          </Text>
        ) : null
      }
    />
  )
}

function ReportsHeader({ expanded }: { expanded: boolean }) {
  const styles = useStyles()
  const { t } = useT("report-list")
  return (
    <View style={expanded ? styles.titleRow : styles.sectionHeader}>
      <Text
        style={expanded ? styles.title : styles.sectionTitle}
        accessibilityRole="header"
        {...headingLevel(expanded ? 1 : 2)}
      >
        {t("section_title")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  partialHint: {
    textAlign: "center",
    paddingVertical: t.space["4"],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["3"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    color: t.colors.text,
    letterSpacing: -0.3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 14,
    marginBottom: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.5,
    color: t.colors.text,
  },
}))
