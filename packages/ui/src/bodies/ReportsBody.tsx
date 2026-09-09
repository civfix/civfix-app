import { useCallback, useMemo, useState } from "react"
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from "react-native"
import type { ReportDTO, MediaDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, useTheme, useLayoutMode, webInputReset, headingLevel } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { EmptyState, LoadingState, SignInPrompt } from "../primitives"
import { useMyReports, useAuthState, useRequireAuth } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { idKeyExtractor } from "./navHelpers"
import { ReportRowView } from "./ReportRow"
import { useListTimeAgo } from "./useListTimeAgo"
import { matchesReportQuery } from "./reportsListModel"
import { useT } from "../i18n"

export function firstReportPhoto(report: ReportDTO): MediaDTO | undefined {
  return report.media.find((m) => m.kind === "image" && m.status === "ready")
}

export function latestNote(report: ReportDTO): string | undefined {
  const last = report.timeline.at(-1)
  return last?.note?.trim() || undefined
}

export function ReportsBody() {
  const styles = useStyles()
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
  const onEndReached = useCallback(() => {
    if (filtering) return
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [filtering, hasNextPage, isFetchingNextPage, fetchNextPage])
  const showSearch = layout === "expanded" && all.length > 0
  const showTitle = layout === "compact" ? reports.length > 0 : atViewRoot

  const timeAgo = useListTimeAgo()
  const renderItem = useCallback(({ item }: { item: ReportDTO }) => {
    const photo = firstReportPhoto(item)
    return (
      <ReportRowView
        id={item.id}
        category={item.category}
        status={item.status}
        title={item.title?.trim() || t(`enums:category.${item.category}`)}
        lat={item.lat}
        lng={item.lng}
        thumbUrl={photo ? photo.thumbUrl ?? photo.url : null}
        subtitle={item.addr ?? null}
        when={timeAgo(item.createdAt)}
        note={latestNote(item) ?? null}
      />
    )
  }, [t, timeAgo])

  const signedOut = !isAuthenticated && !isPending

  return (
    <FlatList
      data={signedOut ? [] : reports}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={signedOut || reports.length === 0 ? styles.listEmpty : styles.listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <>
          {showTitle ? <ReportsHeader expanded={layout === "expanded"} /> : null}
          {showSearch ? <ReportsSearchField value={search} onChangeText={setSearch} /> : null}
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
        ) : isPending || query.isLoading ? (
          <LoadingState skeleton="report" rows={7} />
        ) : q ? (
          <EmptyState
            variant="detail"
            icon={iconMap.Search}
            title={t("empty.no_match.title")}
            body={t("empty.no_match.body", { query: search.trim() })}
          />
        ) : query.isError ? (
          <EmptyState
            variant="detail"
            icon={iconMap.CloudOff}
            tone="neutral"
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        ) : (
          <EmptyState
            variant="detail"
            icon={iconMap.MapPin}
            title={t("empty.none.title")}
            body={t("empty.none.body")}
          />
        )
      }
      ListFooterComponent={
        !filtering && reports.length > 0 && isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={th.colors.textSubtle} />
          </View>
        ) : null
      }
    />
  )
}

function ReportsSearchField({
  value,
  onChangeText,
}: {
  value: string
  onChangeText: (q: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-list")
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.searchField, focused ? styles.searchFieldFocused : null]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        style={[styles.searchInput, webInputReset]}
        placeholder={t("search.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t("search.a11y")}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t("search.clear_a11y")}
          hitSlop={6}
          {...focusRingProps}
          style={({ pressed }) => [styles.clearBtn, pressed ? styles.clearBtnPressed : null]}
        >
          <Icon icon={iconMap.Close} size={14} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
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
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 42,
    marginTop: t.space["2"],
    marginBottom: t.space["2"],
    paddingHorizontal: 12,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  searchFieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    color: t.colors.text,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  clearBtnPressed: {
    backgroundColor: t.colors.border,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: 0,
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  footer: {
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
