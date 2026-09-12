import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet, Platform } from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { ViewStyle } from "react-native"
import { haversineMeters } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import type { CleanupDTO } from "@civfix/shared"
import { eventChip, dowLabel, timeLabel } from "@civfix/shared/datetime"
import {
  focusRingProps,
  makeThemedStyles,
  space,
  useLayoutMode,
  useTheme,
  webInputReset,
  webTransition,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { MetaDot, RsvpPill, EmptyState, OrgAffiliationBadge } from "../primitives"
import { useCleanups, useJoinCleanup, useAttendingCleanups, useUserLocation, useAuthState } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useLocale, useRelativeTime, useT } from "../i18n"
import { pushCleanup } from "./navHelpers"
import { useRowHover } from "./rowHover"
import { eventDistanceLabel } from "./eventDistance"
import { eventBlendScore } from "./eventBlendScore"

type Row =
  | { kind: "header"; key: string; title: string; topGap: number }
  | { kind: "event"; key: string; cleanup: CleanupDTO; topGap: number }

const HEADER_TO_CARD = space["2"]
const CARD_GAP = space["3"] + 2
const SECTION_GAP = space["4"]

const IS_WEB = Platform.OS === "web"

const CARD_RING_INSET = space["4"] + StyleSheet.hairlineWidth
const WEB_CARD_RING: ViewStyle = IS_WEB
  ? ({ outlineOffset: CARD_RING_INSET } as unknown as ViewStyle)
  : {}

const SheetEventCard = React.memo(function SheetEventCard({
  cleanup,
  onPress,
}: {
  cleanup: CleanupDTO
  onPress: (cleanup: CleanupDTO) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-list")
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const { day, month } = eventChip(cleanup.scheduledAt, locale)
  const join = useJoinCleanup(cleanup.id)
  const dist = eventDistanceLabel(cleanup.dist)
  const where = cleanup.address?.trim()
  const blurb = cleanup.description?.trim()
  const { hovered, hoverProps } = useRowHover()

  return (
    <View {...hoverProps} style={[styles.card, webTransition, hovered ? styles.cardHovered : null]}>
      <Pressable
        onPress={() => onPress(cleanup)}
        accessibilityRole="button"
        accessibilityLabel={t("card.a11y", { title: cleanup.title, count: cleanup.going })}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.cardTap,
          WEB_CARD_RING,
          pressed ? styles.cardPressed : null,
        ]}
      >
        <View style={styles.date}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text color={th.colors.bloom["600"]} style={styles.dateMonth}>
            {month}
          </Text>
        </View>

        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {cleanup.title}
            </Text>
            {cleanup.organization ? (
              <OrgAffiliationBadge organization={cleanup.organization} size="sm" interactive={false} />
            ) : null}
          </View>

          <View style={styles.sub}>
            <Icon icon={iconMap.Clock} size={12} color={th.colors.textSubtle} />
            <Text style={styles.subText} numberOfLines={1}>
              {dowLabel(cleanup.scheduledAt, weekdays)}
            </Text>
            <MetaDot style={styles.metaDot} />
            <Text style={styles.subText} numberOfLines={1}>
              {timeLabel(cleanup.scheduledAt, locale)}
            </Text>
            {where ? (
              <>
                <MetaDot style={styles.metaDot} />
                <Text style={[styles.subText, styles.subWhere]} numberOfLines={1}>
                  {where}
                </Text>
              </>
            ) : null}
          </View>

          {blurb ? (
            <Text style={styles.blurb} numberOfLines={2}>
              {blurb}
            </Text>
          ) : null}

          <View style={styles.foot}>
            <View style={styles.cnt}>
              <Icon icon={iconMap.Users} size={13} color={th.colors.textSubtle} />
              <Text style={[styles.cntText, dist ? styles.cntTextSep : null]} numberOfLines={2}>
                {t("card.going", { count: cleanup.going })}
              </Text>
              {dist ? (
                <View style={styles.cntDistGroup}>
                  <View style={styles.cntSep}>
                    <MetaDot color={th.colors.textMuted} style={styles.metaDot} />
                  </View>
                  <Text style={styles.cntDist} numberOfLines={1}>
                    {dist}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
      <View style={styles.rsvpSlot}>
        <RsvpPill
          going={cleanup.joined}
          onToggle={(currentlyGoing) => join.mutate(currentlyGoing)}
          busy={join.isPending}
          nextPath={`/cleanups/${cleanup.id}`}
          size="sm"
        />
      </View>
    </View>
  )
})

function CardSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.card}>
      <View style={styles.cardTap}>
        <View style={styles.skelDate} />
        <View style={styles.meta}>
          <View style={[styles.skelLine, { width: "66%" }]} />
          <View style={[styles.skelLine, styles.skelLineSm, { width: "48%" }]} />
          <View style={[styles.skelLine, styles.skelLineSm, { width: "34%" }]} />
        </View>
      </View>
    </View>
  )
}

export function EventsBody() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-list")
  const { FlatList } = useScrollHost()
  const query = useCleanups("upcoming")
  const all = query.data ?? []
  const { isAuthenticated } = useAuthState()
  const attendingQuery = useAttendingCleanups()
  const location = useUserLocation().data ?? null
  const now = useMemo(() => new Date(), [])
  const layout = useLayoutMode()
  const atViewRoot = useNavStore((s) => s.stack.length === 0)
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const matchesSearch = useCallback(
    (c: CleanupDTO) =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      (c.address ?? "").toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q),
    [q],
  )
  const events = useMemo(() => all.filter(matchesSearch), [all, matchesSearch])

  const rows = useMemo<Row[]>(() => {
    const attending = (isAuthenticated ? (attendingQuery.data ?? []) : []).filter(matchesSearch)
    const attendingIds = new Set(attending.map((c) => c.id))

    const inYourArea = events
      .filter((c) => !attendingIds.has(c.id))
      .map((c) => {
        const meters = location ? (c.dist ?? haversineMeters(location, { lat: c.lat, lng: c.lng })) : null
        return { c, score: eventBlendScore(meters, c.scheduledAt, now) }
      })
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c)

    const out: Row[] = []
    if (attending.length) {
      out.push({ kind: "header", key: "h-attending", title: t("section.attending"), topGap: 0 })
      attending.forEach((c, i) =>
        out.push({ kind: "event", key: `a-${c.id}`, cleanup: c, topGap: i === 0 ? HEADER_TO_CARD : CARD_GAP }),
      )
    }
    if (inYourArea.length) {
      out.push({
        kind: "header",
        key: "h-area",
        title: t("section.inYourArea"),
        topGap: out.length ? SECTION_GAP : 0,
      })
      inYourArea.forEach((c, i) =>
        out.push({ kind: "event", key: `e-${c.id}`, cleanup: c, topGap: i === 0 ? HEADER_TO_CARD : CARD_GAP }),
      )
    }
    return out
  }, [events, attendingQuery.data, isAuthenticated, matchesSearch, location, now, t])

  const onOpenEvent = useCallback((cleanup: CleanupDTO) => {
    pushCleanup(cleanup)
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      item.kind === "header" ? (
        <Text style={[styles.sectionHeader, { marginTop: item.topGap }]}>{item.title}</Text>
      ) : (
        <View style={{ marginTop: item.topGap }}>
          <SheetEventCard cleanup={item.cleanup} onPress={onOpenEvent} />
        </View>
      ),
    [onOpenEvent],
  )

  return (
    <FlatList
      data={rows}
      keyExtractor={(row: Row) => row.key}
      style={styles.list}
      contentContainerStyle={rows.length === 0 ? styles.listEmpty : styles.listContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <EventsHeader
          query={search}
          onChangeQuery={setSearch}
          showSearch={layout === "expanded" && all.length > 0}
          showTitle={layout === "expanded" && atViewRoot}
        />
      }
      renderItem={renderItem}
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.skelList}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : query.isError ? (
          <EmptyState
            icon={iconMap.CloudOff}
            tone="neutral"
            iconColor={th.colors.textSubtle}
            title={t("empty.error.title")}
            body={t("empty.error.body")}
          />
        ) : q ? (
          <EmptyState
            icon={iconMap.Search}
            title={t("empty.search.title")}
            body={t("empty.search.body", { query: search.trim() })}
          />
        ) : (
          <EmptyState
            icon={iconMap.Leaf}
            tone="moss"
            title={t("empty.none.title")}
            body={t("empty.none.body")}
          />
        )
      }
    />
  )
}

function EventsHeader({
  query,
  onChangeQuery,
  showSearch,
  showTitle,
}: {
  query: string
  onChangeQuery: (q: string) => void
  showSearch: boolean
  showTitle: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-list")
  const { t: tNav } = useT("nav")
  const [focused, setFocused] = useState(false)
  return (
    <View>
      {showTitle ? (
        <View style={styles.rootTitleRow}>
          <Text accessibilityRole="header" style={styles.rootTitle}>
            {tNav("title.cleanups")}
          </Text>
        </View>
      ) : null}
      {showSearch ? (
        <View style={[styles.searchField, focused ? styles.searchFieldFocused : null]}>
          <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
          <TextInput
            style={[styles.searchInput, webInputReset]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("search.a11y")}
          />
          {query ? (
            <Pressable
              onPress={() => onChangeQuery("")}
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
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
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

  rootTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 14,
    marginBottom: t.space["1"],
  },
  rootTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.5,
    color: t.colors.text,
  },

  sectionHeader: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textSubtle,
  },

  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["4"],
  },
  cardTap: {
    flexDirection: "row",
    gap: t.space["4"],
    borderRadius: t.radius.lg - CARD_RING_INSET,
  },
  cardHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  cardPressed: {
    opacity: 0.92,
  },
  date: {
    width: 50,
    flexShrink: 0,
    alignSelf: "flex-start",
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
  },
  dateDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 23,
    lineHeight: 23,
    color: t.colors.text,
  },
  dateMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 0.55,
    marginTop: 3,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 19,
    color: t.colors.text,
  },
  sub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  subText: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  subWhere: {
    flexShrink: 1,
  },
  blurb: {
    marginTop: 4,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.textMuted,
  },
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
  metaDot: {
    marginHorizontal: 0,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingRight: 88,
  },
  cnt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
    flexWrap: "wrap",
    minWidth: 0,
    overflow: "hidden",
  },
  cntText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  cntTextSep: {
    marginRight: 8,
  },
  cntDistGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  cntSep: {
    position: "absolute",
    left: -8,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  cntDist: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.textMuted,
  },
  rsvpSlot: {
    position: "absolute",
    right: t.space["4"],
    bottom: t.space["4"],
    pointerEvents: "box-none",
  },

  skelList: {
    alignSelf: "stretch",
    gap: t.space["3"] + 2,
  },
  skelDate: {
    width: 50,
    height: 56,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: t.colors.bgAlt,
  },
  skelLine: {
    height: 13,
    borderRadius: 7,
    backgroundColor: t.colors.bgAlt,
  },
  skelLineSm: {
    height: 10,
    marginTop: 7,
  },
}))
