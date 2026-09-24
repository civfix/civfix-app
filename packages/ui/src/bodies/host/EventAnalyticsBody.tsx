import React, { useState } from "react"
import { View } from "react-native"
import type { AnalyticsRange } from "@civfix/shared"
import { headingLevel, makeThemedStyles } from "../../theme"
import { Text, iconMap } from "../../typography"
import type { AnchorRect } from "../../primitives"
import { PopoverMenu, SecondaryButton, SegmentedControl, usePopoverAnchor } from "../../primitives"
import { useMeasuredWidth } from "../../charts"
import { useCleanup } from "../../data/hooks/cleanups"
import { cleanupHostStanding, hasHostCapability } from "../../data/hooks/host"
import { useAuthState } from "../../data"
import { useEventAnalytics, useHostAnalyticsSummary } from "../../data/hooks/analytics"
import { useRelativeTime, useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { HeroSkeleton, TilesSkeleton } from "./HostSkeletons"
import {
  ALL_EVENTS_RANGE_PRESETS,
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ALL_EVENTS_PRESET,
  DEFAULT_EVENT_PRESET,
  eventRowTarget,
  presetDays,
  type AnalyticsRangePreset,
} from "./analyticsModel"
import { AllEventsMode } from "./analytics/AllEventsMode"
import { SingleEventMode } from "./analytics/SingleEventMode"
import { useHostedEventOptions } from "./analytics/useHostedEventOptions"

function summaryRange(preset: AnalyticsRangePreset): AnalyticsRange {
  return preset === "whole_event" ? "all" : preset
}

export function EventAnalyticsBody({ id }: { id: string }) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("host-analytics")
  const { relative, justNow } = useRelativeTime()

  const [picked, setPicked] = useState<string | null>(id === "" ? null : id)
  const [pickedLabel, setPickedLabel] = useState<string | null>(null)
  const [preset, setPreset] = useState<AnalyticsRangePreset | null>(null)
  const [routeId, setRouteId] = useState(id)
  if (id !== routeId) {
    setRouteId(id)
    setPicked(id === "" ? null : id)
    setPickedLabel(null)
    setPreset(null)
  }
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRect, setPickerRect] = useState<AnchorRect | null>(null)
  const { ref: pickerAnchorRef, measure: measurePicker } = usePopoverAnchor(setPickerRect)
  const { width: stackWidth, onLayout } = useMeasuredWidth()

  const all = picked === null
  const presets: readonly AnalyticsRangePreset[] = all
    ? ALL_EVENTS_RANGE_PRESETS
    : ANALYTICS_RANGE_PRESETS
  const fallback = all ? DEFAULT_ALL_EVENTS_PRESET : DEFAULT_EVENT_PRESET
  const active: AnalyticsRangePreset =
    preset !== null && presets.includes(preset) ? preset : fallback

  const { options, moreEvents, loadingMoreEvents, loadMoreEvents } = useHostedEventOptions()

  const summary = useHostAnalyticsSummary(null, summaryRange(active), { enabled: all })
  const cleanup = useCleanup(picked ?? undefined)
  const viewerId = useAuthState().user?.id ?? null
  const canView = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "view_analytics")
  const event = useEventAnalytics(picked ?? undefined, "full", { enabled: !all && canView })

  const now = Date.now()
  const generatedAt = all ? (summary.data?.generatedAt ?? null) : (event.data?.generatedAt ?? null)
  const updatedAgo = generatedAt === null ? null : relative(generatedAt, now)

  const pickedTitle =
    picked === null
      ? null
      : (options.find((option) => option.id === picked)?.title ?? pickedLabel)

  const filters = (
    <View style={styles.filters}>
      <View ref={pickerAnchorRef} style={styles.pickerSlot}>
        <SecondaryButton
          size="sm"
          trailingIcon={iconMap.ChevronDown}
          label={pickedTitle ?? t("filter.all_events")}
          accessibilityLabel={t("filter.event_a11y", {
            name: pickedTitle ?? t("filter.all_events"),
          })}
          onPress={() => {
            measurePicker()
            setPickerOpen(true)
          }}
        />
      </View>
      <SegmentedControl
        size="sm"
        label={t("range.label")}
        selected={active}
        onSelect={(key) => setPreset(key as AnalyticsRangePreset)}
        options={presets.map((key) => ({ key, label: t(`range.${key}`) }))}
      />
    </View>
  )

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header" {...headingLevel(1)}>
        {all ? t("page.all_title") : t("page.title")}
      </Text>
      {updatedAgo === null ? null : (
        <Text variant="caption">
          {updatedAgo === justNow
            ? t("page.updated_just_now")
            : t("page.updated", { when: updatedAgo })}
        </Text>
      )}
    </View>
  )

  const picker = (
    <PopoverMenu
      visible={pickerOpen}
      anchorRect={pickerRect}
      align="left"
      onClose={() => setPickerOpen(false)}
      items={[
        {
          key: "all",
          label: t("filter.all_events"),
          ...(picked === null ? { icon: "Check" as const } : {}),
          onPress: () => {
            setPickerOpen(false)
            setPicked(null)
            setPickedLabel(null)
            setPreset(null)
          },
        },
        ...options.map((option) => ({
          key: option.id,
          label: option.title,
          ...(picked === option.id ? { icon: "Check" as const } : {}),
          onPress: () => {
            setPickerOpen(false)
            setPicked(option.id)
            setPickedLabel(option.title)
            setPreset(null)
          },
        })),
        ...(moreEvents
          ? [
              {
                key: "more",
                label: loadingMoreEvents ? t("filter.loading_more") : t("filter.more_events"),
                disabled: loadingMoreEvents,
                keepOpen: true,
                onPress: loadMoreEvents,
              },
            ]
          : []),
      ]}
    />
  )

  const frame = (content: React.ReactNode) => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stack} onLayout={onLayout}>
        {header}
        {filters}
        {content}
      </View>
      {picker}
    </ScrollView>
  )

  const skeleton = (
    <View style={styles.stack}>
      <HeroSkeleton />
      <TilesSkeleton columns={2} count={6} />
    </View>
  )

  const errorState = (retry: () => void) => (
    <FeedNotice
      plain
      icon="CloudOff"
      title={t("state.error_title")}
      body={t("state.error_body")}
      actionLabel={t("card.retry")}
      onAction={retry}
    />
  )

  if (all) {
    if (summary.isPending) return frame(skeleton)
    if (summary.isError || !summary.data)
      return frame(errorState(() => void summary.refetch()))
    return frame(
      <AllEventsMode
        data={summary.data}
        width={stackWidth}
        onPickEvent={(row) => {
          const target = eventRowTarget(row, options)
          if (target === null) return
          setPicked(target.id)
          setPickedLabel(target.title)
          setPreset(null)
        }}
      />,
    )
  }

  if (cleanup.isPending) return frame(skeleton)

  if (cleanup.isError) return frame(errorState(() => void cleanup.refetch()))

  if (!canView) {
    return frame(
      <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />,
    )
  }

  if (event.isPending) return frame(skeleton)

  if (event.isError || !event.data) return frame(errorState(() => void event.refetch()))

  return frame(
    <SingleEventMode data={event.data} width={stackWidth} days={presetDays(active)} now={now} />,
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stack: {
    gap: t.space["6"],
  },
  header: {
    gap: t.space["1"],
  },
  filters: {
    gap: t.space["2"],
  },
  pickerSlot: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
}))
