import { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { CleanupDTO, ReportPinDTO } from "@civfix/shared"
import { cleanupColorFor } from "@civfix/shared/tokens"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { EmptyState } from "../primitives"
import { useReport } from "../data"
import { useNavStore } from "../nav"
import { useT, useLocale } from "../i18n"
import { useScrollHost } from "../shell/ScrollHost"
import { idKeyExtractor } from "../primitives/listKeys"
import { ReportRowView } from "./ReportRow"
import { firstReportPhoto, latestNote } from "./reportsListModel"
import { useListTimeAgo } from "./useListTimeAgo"

function ClusterReportRow({ pin }: { pin: ReportPinDTO }) {
  const timeAgo = useListTimeAgo()
  const { t } = useT("report-cluster")
  const { data: report } = useReport(pin.id)
  const photo = report ? firstReportPhoto(report) : undefined
  const category = report?.category ?? pin.category
  const title = (report?.title ?? pin.title)?.trim() || t(`enums:category.${category}`)

  return (
    <ReportRowView
      id={pin.id}
      category={category}
      status={report?.status ?? pin.status}
      title={title}
      lat={pin.lat}
      lng={pin.lng}
      thumbUrl={photo ? photo.thumbUrl ?? photo.url : pin.thumbUrl ?? null}
      subtitle={report ? report.addr ?? pin.description ?? null : pin.description ?? null}
      when={report ? timeAgo(report.createdAt) : " "}
      note={report ? latestNote(report) ?? null : null}
    />
  )
}

function ClusterEventRow({ event }: { event: CleanupDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { locale } = useLocale()
  const onPress = useCallback(() => {
    useNavStore
      .getState()
      .push({ kind: "cleanup", id: event.id, title: event.title, lat: event.lat, lng: event.lng })
  }, [event.id, event.title, event.lat, event.lng])
  const when = new Date(event.scheduledAt).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  const subtitle = event.address ?? when
  const tint =
    event.eventKind === "other_volunteer" ? th.colors.brand.lilac : cleanupColorFor(th.scheme)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      {...focusRingProps}
      style={({ pressed }) => [styles.eventRow, pressed ? styles.eventRowPressed : null]}
    >
      <View style={[styles.eventIcon, { backgroundColor: tint }]}>
        <Icon icon={iconMap.Calendar} size={18} color={th.colors.onAccent} />
      </View>
      <View style={styles.eventMeta}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.eventSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

export function ClusterReportsBody({
  reports,
  event = null,
}: {
  reports: ReportPinDTO[]
  event?: CleanupDTO | null
}) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const { t } = useT("report-cluster")

  const renderItem = useCallback(
    ({ item }: { item: ReportPinDTO }) => <ClusterReportRow pin={item} />,
    [],
  )

  return (
    <FlatList
      data={reports}
      keyExtractor={idKeyExtractor}
      style={styles.list}
      contentContainerStyle={reports.length === 0 ? styles.listEmpty : styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      ListHeaderComponent={event ? <ClusterEventRow event={event} /> : undefined}
      ListEmptyComponent={
        <View style={styles.stateFill}>
          <EmptyState
            variant="detail"
            icon={iconMap.MapPin}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        </View>
      }
    />
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  stateFill: {
    flex: 1,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"] + 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  eventRowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  eventMeta: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  eventSubtitle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 3,
  },
}))
