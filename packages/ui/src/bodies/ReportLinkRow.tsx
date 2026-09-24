import React, { useEffect, useMemo } from "react"
import { Animated, StyleSheet } from "react-native"
import { haversineMeters } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { useTheme } from "../theme"
import { SkeletonBlock, POP_ENABLED, usePopScale } from "../primitives"
import { useReport } from "../data"
import { useT } from "../i18n"
import { LinkedReportCard } from "./LinkedReportCard"
import {
  reportToCardData,
  useLinkedReportCards,
  type LinkedReportCardEntry,
} from "./linkedReportCards"
import { localReportThumb } from "./localReportThumbs"
import { reportShortCode } from "./reportPicker/reportPickerModel"
import { METERS_PER_MILE } from "./reportHitRowModel"
import { distanceLabel } from "./relativeTime"

const ROW_SKELETON_HEIGHT = 64

export interface ReportLinkRowProps {
  id: string
  center: LatLng | null
  selected: boolean
  card?: LinkedReportCardEntry
  disabled?: boolean
  onToggle: (id: string, title: string) => void
}

export function ReportLinkRow({
  id,
  center,
  selected,
  card: given,
  disabled = false,
  onToggle,
}: ReportLinkRowProps) {
  const th = useTheme()
  const { t } = useT("event-form")
  const { t: tLinked } = useT("report-linked")
  const { t: tEnums } = useT("enums")
  const cached = useLinkedReportCards((s) => s.cards[id])
  const known = given ?? cached
  const query = useReport(known ? undefined : id)
  const fetchedId = query.data?.id === id ? id : null
  const fetched = fetchedId && query.data ? reportToCardData(query.data) : null
  const popScale = usePopScale(selected)

  useEffect(() => {
    if (fetchedId) {
      const report = useLinkedReportCards.getState().cards[fetchedId]
      if (!report && query.data) useLinkedReportCards.getState().put([reportToCardData(query.data)])
    }
  }, [fetchedId, query.data])

  const resolved: LinkedReportCardEntry | undefined = known ?? fetched ?? undefined
  const card = useMemo(
    () => (resolved ? { ...resolved, thumbUrl: resolved.thumbUrl ?? localReportThumb(resolved.id) } : undefined),
    [resolved],
  )

  const view = useMemo(() => {
    if (!card) return null
    const categoryLabel = tEnums(`category.${card.category}`)
    const title = card.title?.trim() || categoryLabel
    const distance = center
      ? distanceLabel(haversineMeters(center, { lat: card.lat, lng: card.lng }) / METERS_PER_MILE)
      : ""
    const addr = card.addr?.trim() ?? ""
    const location = [distance, addr].filter(Boolean).join(" · ")
    const code = reportShortCode(card)
    return {
      title,
      code,
      subtitle: location || card.description?.trim() || null,
      a11yLabel: distance
        ? tLinked("card.a11yLabelCode", { title, category: categoryLabel, code, distance })
        : tLinked("card.a11yLabel", { title, category: categoryLabel }),
    }
  }, [card, center, tEnums, tLinked])

  if (!card || !view) {
    if (query.isLoading) return <SkeletonBlock width="100%" height={ROW_SKELETON_HEIGHT} radius={th.radius.lg} />
    const unavailable = t("linkedReports.unavailable_row")
    return (
      <LinkedReportCard
        report={{ id, category: "other", status: null, title: unavailable }}
        layout="list"
        headline="title"
        subtitle={t("linkedReports.unavailable_sub")}
        selectable
        selected={selected}
        disabled={disabled}
        onPress={() => onToggle(id, unavailable)}
      />
    )
  }

  const content = (
    <LinkedReportCard
      report={card}
      layout="list"
      headline="title"
      subtitle={view.subtitle}
      code={view.code}
      a11yLabel={view.a11yLabel}
      selectable
      selected={selected}
      disabled={disabled}
      onPress={() => onToggle(id, view.title)}
    />
  )

  if (!POP_ENABLED) return content
  return <Animated.View style={[styles.pop, { transform: [{ scale: popScale }] }]}>{content}</Animated.View>
}

const styles = StyleSheet.create({
  pop: {
    width: "100%",
  },
})
