import React from "react"
import { View } from "react-native"
import type { EventSlotDTO } from "@civfix/shared"
import { makeThemedStyles } from "../../theme"
import { Text, iconMap } from "../../typography"
import { PrimaryButton } from "../../primitives"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import { useAuthState, useCleanup } from "../../data"
import { cleanupHostStanding, hasHostCapability, useHostCounters } from "../../data/hooks/host"
import { useT } from "../../i18n"
import { useScrollHost } from "../../shell/ScrollHost"
import { rosterListKey } from "../rosterSlotGroups"
import { CheckinCounters, CheckinResultCard, OutboxBanner, ReplayReportCard } from "./checkin/CheckinDeskCards"
import { ManualCodeEntry } from "./checkin/CheckinManualEntry"
import { HostBodyState } from "./HostBodyState"
import { CheckinRosterSection } from "./checkin/CheckinRosterSection"
import { checkinRosterListed } from "./checkin/checkinRosterModel"
import {
  CheckinRosterMore,
  useCheckinRosterItems,
  useCheckinRosterRenderer,
  type CheckinRosterItem,
} from "./checkin/CheckinRosterRows"
import { useCheckinRoster } from "./checkin/useCheckinRoster"
import { useCheckinDesk } from "./checkin/useCheckinDesk"

const NO_SLOTS: readonly EventSlotDTO[] = []
const NO_ROSTER_ITEMS: readonly CheckinRosterItem[] = []

export function HostCheckinBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("host-checkin")
  const { FlatList } = useScrollHost()

  const cleanup = useCleanup(id)
  const desk = useCheckinDesk(id)
  const canScan = useScannerAvailable()

  const viewerId = useAuthState().user?.id ?? null
  const canCheckIn = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "check_in")
  const counters = useHostCounters(id, { enabled: canCheckIn })
  const rosterState = useCheckinRoster(id, canCheckIn, desk.undo)
  const rosterItems = useCheckinRosterItems(rosterState.waiting, cleanup.data?.slots ?? NO_SLOTS)
  const renderRosterItem = useCheckinRosterRenderer({
    timeZone: cleanup.data?.timezone ?? undefined,
    pending: rosterState.pending,
    onCheckIn: rosterState.onRosterCheckIn,
    onUndo: rosterState.onRosterUndo,
  })

  if (cleanup.isLoading) {
    return <HostBodyState state="loading" t={t} />
  }

  if (cleanup.isError || !cleanup.data) {
    return <HostBodyState state="error" t={t} />
  }

  if (!canCheckIn) {
    return <HostBodyState state="denied" t={t} />
  }

  const { outbox } = desk
  const rosterListed = checkinRosterListed(rosterState.roster, rosterState.waiting)

  return (
    <FlatList
      data={rosterListed ? rosterItems : NO_ROSTER_ITEMS}
      keyExtractor={rosterListKey}
      renderItem={renderRosterItem}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={[styles.desk, rosterListed ? styles.deskAboveRoster : null]}>
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
            search={rosterState.rosterSearch}
            onSearchChange={rosterState.setRosterSearch}
            searchFocused={rosterState.rosterFocused}
            onSearchFocusChange={rosterState.setRosterFocused}
            roster={rosterState.roster}
            waiting={rosterState.waiting}
          />
        </View>
      }
      ListFooterComponent={rosterListed ? <CheckinRosterMore paging={rosterState.roster} /> : null}
    />
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
  desk: {
    gap: t.space["4"],
  },
  deskAboveRoster: {
    paddingBottom: t.space["2"],
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
