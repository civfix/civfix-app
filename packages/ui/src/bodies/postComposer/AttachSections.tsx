import React from "react"
import { View } from "react-native"
import type { TFunction } from "i18next"
import { headingLevel } from "../../theme"
import { Text } from "../../typography"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { buildComposerEventRef, type PostComposerAttachGroupPlan } from "../postComposerModel"
import type { PostComposerAttach } from "../usePostComposerAttach"
import { AttachedEventCard, AttachedReportCard } from "./AttachedCards"
import { ListActionButton } from "./ListActionButton"
import { usePostComposerStyles } from "./postComposerStyles"

function AttachGroup({
  title,
  plan,
  attached,
  candidates,
  showMore,
  showFewer,
}: {
  title: string
  plan: PostComposerAttachGroupPlan
  attached: React.ReactNode
  candidates: React.ReactNode
  showMore: React.ReactNode
  showFewer: React.ReactNode
}) {
  const styles = usePostComposerStyles()
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.groupTitle}>{title}</Text>
      </View>
      {plan.state === "attached" ? attached : null}
      {plan.state === "list" ? (
        <View style={styles.groupList}>
          {candidates}
          {plan.showMoreVisible || plan.showFewerVisible ? (
            <View style={styles.groupActions}>
              {plan.showMoreVisible ? showMore : null}
              {plan.showFewerVisible ? showFewer : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function AttachSections({ attach, t }: { attach: PostComposerAttach; t: TFunction }) {
  const styles = usePostComposerStyles()
  const { attachPlan } = attach
  const showMoreLabel = (count: number | null) =>
    count != null ? t("section.show_more_count", { count }) : t("section.show_more")
  return (
    <View style={styles.attachArea}>
      {attach.eventsSectionVisible ? (
        <AttachGroup
          title={t("section.events")}
          plan={attachPlan.events}
          attached={<AttachedEventCard attach={attach} />}
          candidates={attach.eventCandidates.slice(0, attachPlan.events.visibleCount).map((event) => (
            <LinkedEventCard
              key={event.id}
              event={buildComposerEventRef(event)}
              cleanup={event}
              layout="list"
              timeZone={event.timezone ?? undefined}
              selectable
              selected={false}
              onPress={() => attach.attachEvent(event)}
            />
          ))}
          showMore={
            <ListActionButton
              label={showMoreLabel(attachPlan.events.showMoreCount)}
              accessibilityState={{ expanded: attach.eventsExpanded }}
              onPress={attach.showMoreEvents}
            />
          }
          showFewer={
            <ListActionButton
              label={t("section.show_fewer")}
              accessibilityState={{ expanded: attach.eventsExpanded }}
              onPress={attach.showFewerEvents}
            />
          }
        />
      ) : null}

      {attach.reportsSectionVisible ? (
        <AttachGroup
          title={t("section.reports")}
          plan={attachPlan.reports}
          attached={<AttachedReportCard attach={attach} />}
          candidates={attach.reportCandidates.slice(0, attachPlan.reports.visibleCount).map((report) => (
            <LinkedReportCard
              key={report.id}
              report={report}
              layout="list"
              selectable
              selected={false}
              onPress={() => attach.attachReport(report.id)}
            />
          ))}
          showMore={
            <ListActionButton
              label={showMoreLabel(attachPlan.reports.showMoreCount)}
              accessibilityState={{ expanded: attach.reportsExpanded, disabled: attach.fetchingMoreReports }}
              disabled={attach.fetchingMoreReports}
              onPress={attach.showMoreReports}
            />
          }
          showFewer={
            <ListActionButton
              label={t("section.show_fewer")}
              accessibilityState={{ expanded: attach.reportsExpanded }}
              onPress={attach.showFewerReports}
            />
          }
        />
      ) : null}
    </View>
  )
}
