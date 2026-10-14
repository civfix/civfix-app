import React from "react"
import { Pressable, ScrollView, View } from "react-native"
import type { TFunction } from "i18next"
import { focusRingProps, useTheme } from "../../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../../typography"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { buildComposerEventRef } from "../postComposerModel"
import type { PostComposerDraft } from "../postComposerStore"
import type { PostComposerAttach } from "../usePostComposerAttach"
import { AttachedEventCard, AttachedReportCard } from "./AttachedCards"
import { ListActionButton } from "./ListActionButton"
import { usePostComposerStyles } from "./postComposerStyles"

function AttachPanel({
  kind,
  attach,
  draft,
  t,
}: {
  kind: "events" | "reports"
  attach: PostComposerAttach
  draft: PostComposerDraft
  t: TFunction
}) {
  const styles = usePostComposerStyles()
  const group = kind === "events" ? attach.attachPlan.events : attach.attachPlan.reports
  return (
    <ScrollView style={styles.panel} nestedScrollEnabled contentContainerStyle={styles.pickerContent}>
      {group.state === "loading" ? <View style={styles.groupPlaceholder} /> : null}
      {group.state === "empty" ? (
        <Text style={styles.emptyPicker}>{kind === "events" ? t("empty_events") : t("empty_reports")}</Text>
      ) : null}
      {group.state === "list" && kind === "events"
        ? attach.eventCandidates.map((event) => (
            <LinkedEventCard
              key={event.id}
              event={buildComposerEventRef(event)}
              cleanup={event}
              layout="list"
              timeZone={event.timezone ?? undefined}
              selectable
              selected={event.id === draft.attachedEventId}
              onPress={() => attach.attachEvent(event)}
            />
          ))
        : null}
      {group.state === "list" && kind === "reports" ? (
        <>
          {attach.reportCandidates.map((report) => (
            <LinkedReportCard
              key={report.id}
              report={report}
              layout="list"
              selectable
              selected={report.id === draft.attachedReportId}
              onPress={() => attach.attachReport(report.id)}
            />
          ))}
          {group.showMoreVisible ? (
            <ListActionButton
              label={t("section.show_more")}
              accessibilityState={{ disabled: attach.fetchingMoreReports }}
              disabled={attach.fetchingMoreReports}
              onPress={attach.fetchMoreReports}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  )
}

function AttachPill({
  label,
  a11yLabel,
  icon,
  open,
  onPress,
}: {
  label: string
  a11yLabel: string
  icon: LucideIcon
  open: boolean
  onPress: () => void
}) {
  const styles = usePostComposerStyles()
  const th = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      {...focusRingProps}
      style={({ pressed }) => [styles.pill, open ? styles.pillOpen : null, pressed ? styles.listActionPressed : null]}
    >
      <Icon icon={icon} size={16} color={th.colors.accent} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  )
}

/** Reply and quote composers tuck the attach lists behind two pills, one open panel at a time. */
export function AttachPills({ attach, draft, t }: { attach: PostComposerAttach; draft: PostComposerDraft; t: TFunction }) {
  const styles = usePostComposerStyles()
  const { attachPlan } = attach
  const previewsVisible = attach.attachedEvent != null || attach.attachedReport != null
  return (
    <>
      {previewsVisible ? (
        <View style={styles.attachedStack}>
          <AttachedEventCard attach={attach} />
          <AttachedReportCard attach={attach} />
        </View>
      ) : null}
      {attachPlan.eventPanelVisible ? <AttachPanel kind="events" attach={attach} draft={draft} t={t} /> : null}
      {attachPlan.reportPanelVisible ? <AttachPanel kind="reports" attach={attach} draft={draft} t={t} /> : null}
      <View style={styles.pillsRow}>
        <AttachPill
          label={t("pills.event")}
          a11yLabel={t("pills.event_a11y")}
          icon={iconMap.Calendar}
          open={attachPlan.eventPanelVisible}
          onPress={() => attach.togglePanel("events")}
        />
        <AttachPill
          label={t("pills.report")}
          a11yLabel={t("pills.report_a11y")}
          icon={iconMap.MapPin}
          open={attachPlan.reportPanelVisible}
          onPress={() => attach.togglePanel("reports")}
        />
      </View>
    </>
  )
}
