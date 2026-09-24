import React from "react"
import { View } from "react-native"
import type { EventCheckinCountersDTO } from "@civfix/shared"
import type { CheckinReplayReport } from "../../data/checkinOutbox"
import { makeThemedStyles, useTheme, type Theme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { SecondaryButton, StatTile, StatTileRow } from "../../primitives"
import { formatStatValue } from "../../primitives/statTileModel"
import { useLocale, useT } from "../../i18n"
import { checkinResultRender, type CheckinTone } from "./checkinResult"
import type { CheckinResultState } from "./useCheckinDesk"
import { TilesSkeleton } from "./HostSkeletons"

export function CheckinCounters({
  counters,
}: {
  counters: { data?: EventCheckinCountersDTO; isLoading: boolean; isError: boolean }
}) {
  const { t } = useT("host-common")
  const { locale } = useLocale()
  if (counters.isLoading) return <TilesSkeleton columns={4} />
  const data = counters.data
  if (counters.isError || !data) {
    return (
      <Text variant="caption" accessibilityRole="alert">
        {t("counters.error")}
      </Text>
    )
  }
  const shown = (value: number) => formatStatValue(value, locale) ?? String(value)
  return (
    <StatTileRow columns={4}>
      <StatTile label={t("counters.checked_in")} value={shown(data.checkedIn)} />
      <StatTile
        label={t("counters.registered")}
        value={shown(data.registered)}
        hint={data.capacity != null ? t("counters.of_capacity", { capacity: data.capacity }) : undefined}
      />
      <StatTile label={t("counters.waitlist")} value={shown(data.waitlisted)} />
      <StatTile label={t("counters.no_show")} value={shown(data.noShow)} />
    </StatTileRow>
  )
}

export function OutboxBanner({
  pending,
  replaying,
  onRetry,
}: {
  pending: number
  replaying: boolean
  onRetry: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-checkin")
  return (
    <View style={styles.outbox} accessibilityRole="alert">
      <Icon icon={iconMap.WifiOff} size={14} color={th.colors.sun["700"]} />
      <Text style={styles.outboxText}>{t("outbox.pending", { count: pending })}</Text>
      <SecondaryButton label={t("outbox.retry")} size="sm" disabled={replaying} onPress={onRetry} />
    </View>
  )
}

export function ReplayReportCard({ report, onDismiss }: { report: CheckinReplayReport; onDismiss: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-checkin")
  return (
    <View style={styles.replay} accessibilityRole="alert">
      <View style={styles.resultHead}>
        <Icon icon={iconMap.ClipboardList} size={16} color={th.colors.text} />
        <Text style={styles.replayTitle}>{t("replay.title")}</Text>
      </View>
      {report.sent > 0 ? (
        <Text style={styles.replayLine}>{t("replay.sent", { count: report.sent })}</Text>
      ) : null}
      {report.refusals.map((refusal) => (
        <Text key={refusal.outcome} style={styles.replayWarn}>
          {t("replay.refused_line", {
            count: refusal.count,
            label: t(checkinResultRender(refusal.outcome, true).titleKey),
          })}
        </Text>
      ))}
      {report.forbidden > 0 ? (
        <Text style={styles.replayWarn}>{t("replay.forbidden", { count: report.forbidden })}</Text>
      ) : null}
      {report.discarded > 0 ? (
        <Text style={styles.replayWarn}>{t("replay.discarded", { count: report.discarded })}</Text>
      ) : null}
      {report.held > 0 ? (
        <Text style={styles.replayWarn}>{t("replay.held", { count: report.held })}</Text>
      ) : null}
      <View style={styles.resultActions}>
        <SecondaryButton label={t("replay.dismiss")} size="sm" onPress={onDismiss} />
      </View>
    </View>
  )
}

function checkinToneColor(th: Theme, tone: CheckinTone): string {
  const byTone: Record<CheckinTone, string> = {
    success: th.colors.moss["700"],
    warning: th.colors.sun["700"],
    error: th.colors.dangerInk,
    neutral: th.colors.textMuted,
  }
  return byTone[tone]
}

export function CheckinResultCard({
  state,
  undoPending,
  onUndo,
  onDismiss,
}: {
  state: CheckinResultState
  undoPending: boolean
  onUndo: () => void
  onDismiss: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-checkin")
  const render = checkinResultRender(state.result.outcome, state.result.firstTime)
  const toneColor = checkinToneColor(th, render.tone)
  return (
    <View style={[styles.result, { borderColor: toneColor }]} accessibilityRole="alert">
      <View style={styles.resultHead}>
        <Icon icon={iconMap[render.icon]} size={20} color={toneColor} />
        <Text style={[styles.resultTitle, { color: toneColor }]}>{t(render.titleKey)}</Text>
      </View>
      <Text style={styles.resultBody}>{t(render.bodyKey)}</Text>
      {state.result.attendeeName ? (
        <Text style={styles.resultName}>{state.result.attendeeName}</Text>
      ) : null}
      <Text style={styles.resultMeta}>
        {[
          state.result.ticketTypeName ?? null,
          state.result.partySize != null ? t("result.party", { count: state.result.partySize }) : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ")}
      </Text>
      <View style={styles.resultActions}>
        {render.undoable && state.seatId ? (
          <SecondaryButton label={t("result.undo")} size="sm" disabled={undoPending} onPress={onUndo} />
        ) : null}
        <SecondaryButton label={t("result.dismiss")} size="sm" onPress={onDismiss} />
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  outbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.sun["50"],
  },
  outboxText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.sun["700"],
  },
  replay: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  replayTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  replayLine: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  replayWarn: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.dangerInk,
  },
  result: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    backgroundColor: t.colors.surface,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  resultTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
  },
  resultBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  resultName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
    marginTop: t.space["1"],
  },
  resultMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  resultActions: {
    flexDirection: "row",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
}))
