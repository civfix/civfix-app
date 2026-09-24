import React from "react"
import { makeThemedStyles } from "../../theme"
import { Text, iconMap } from "../../typography"
import { PrimaryButton } from "../../primitives"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import { useAuthState, useCleanup } from "../../data"
import { cleanupHostStanding, hasHostCapability, useHostCounters } from "../../data/hooks/host"
import { useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { CheckinCounters, CheckinResultCard, OutboxBanner, ReplayReportCard } from "./checkin/CheckinDeskCards"
import { ManualCodeEntry } from "./checkin/CheckinManualEntry"
import { HostStateNotice } from "./HostStateNotice"
import { CheckinRosterSection } from "./checkin/CheckinRosterSection"
import { useCheckinRoster } from "./checkin/useCheckinRoster"
import { useCheckinDesk } from "./checkin/useCheckinDesk"

export function HostCheckinBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("host-checkin")
  const { ScrollView } = useScrollHost()

  const cleanup = useCleanup(id)
  const desk = useCheckinDesk(id)
  const canScan = useScannerAvailable()

  const viewerId = useAuthState().user?.id ?? null
  const canCheckIn = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "check_in")
  const counters = useHostCounters(id, { enabled: canCheckIn })
  const rosterState = useCheckinRoster(id, canCheckIn, desk.undo)

  if (cleanup.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (cleanup.isError || !cleanup.data) {
    return (
      <HostStateNotice icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
    )
  }

  if (!canCheckIn) {
    return (
      <HostStateNotice icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
    )
  }

  const { outbox } = desk

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CheckinCounters counters={counters} />

      {outbox.pending > 0 ? (
        <OutboxBanner
          pending={outbox.pending}
          replaying={outbox.replaying}
          onRetry={() => void outbox.replay()}
        />
      ) : null}

      {outbox.report ? <ReplayReportCard report={outbox.report} onDismiss={outbox.dismissReport} /> : null}

      {desk.state ? (
        <CheckinResultCard
          state={desk.state}
          undoPending={desk.undo.isPending}
          onUndo={desk.onUndo}
          onDismiss={desk.dismissResult}
        />
      ) : null}

      {canScan ? (
        <PrimaryButton
          label={t("action.scan")}
          icon={iconMap.ScanLine}
          onPress={desk.onScan}
          loading={desk.scan.isPending}
        />
      ) : (
        <Text style={styles.muted}>{t("action.scan_unavailable")}</Text>
      )}

      <ManualCodeEntry
        code={desk.code}
        onChangeCode={desk.setCode}
        onSubmit={desk.onSubmitCode}
        busy={desk.scan.isPending}
        focused={desk.codeFocused}
        onFocusChange={desk.setCodeFocused}
      />

      {desk.errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {desk.errorText}
        </Text>
      ) : null}

      <CheckinRosterSection
        cleanup={cleanup.data}
        search={rosterState.rosterSearch}
        onSearchChange={rosterState.setRosterSearch}
        searchFocused={rosterState.rosterFocused}
        onSearchFocusChange={rosterState.setRosterFocused}
        roster={rosterState.roster}
        waiting={rosterState.waiting}
        pending={rosterState.pending}
        onCheckIn={rosterState.onRosterCheckIn}
        onUndo={rosterState.onRosterUndo}
      />
    </ScrollView>
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
    gap: t.space["4"],
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
