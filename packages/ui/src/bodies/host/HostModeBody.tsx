import React, { useCallback, useState } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text, iconMap } from "../../typography"
import { useScannerAvailable } from "../../primitives/useScannerAvailable"
import { useAuthState, useCleanup } from "../../data"
import { cleanupHostStanding, hasHostCapability, useHostCounters } from "../../data/hooks/host"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { EventActionRow, EventActionRows } from "../EventActionRow"
import { HostCounterStrip } from "./HostCounterStrip"
import { EventRosterBlock } from "./EventRosterBlock"
import { HostWalkupSheet } from "./HostWalkupSheet"

export function HostModeBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const { ScrollView } = useScrollHost()

  const cleanup = useCleanup(id)
  const [walkupOpen, setWalkupOpen] = useState(false)
  const canScan = useScannerAvailable()

  const viewerId = useAuthState().user?.id ?? null
  const standing = cleanupHostStanding(cleanup.data, viewerId)
  const canCheckIn = hasHostCapability(standing, "check_in")
  const canViewRoster = hasHostCapability(standing, "view_roster")
  const canBroadcast = hasHostCapability(standing, "broadcast")
  const canManageTickets = hasHostCapability(standing, "manage_tickets")
  const canManageTeam = hasHostCapability(standing, "manage_team")
  const counters = useHostCounters(id, { enabled: canCheckIn })

  const openCheckin = useCallback(() => {
    useNavStore.getState().push({ kind: "host-checkin", id })
  }, [id])

  const openBroadcast = useCallback(() => {
    useNavStore.getState().push({ kind: "host-broadcast-quick", id })
  }, [id])

  const openTeam = useCallback(() => {
    useNavStore.getState().push({ kind: "host-team", id })
  }, [id])

  if (cleanup.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (cleanup.isError || !cleanup.data) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (!canViewRoster && !canCheckIn) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title} numberOfLines={2}>
        {cleanup.data.title}
      </Text>

      {canCheckIn ? <HostCounterStrip query={counters} /> : null}

      <EventActionRows>
        {canCheckIn ? (
          <EventActionRow
            icon={canScan ? iconMap.ScanLine : iconMap.QrCode}
            label={canScan ? t("action.scan") : t("action.checkin")}
            accessibilityLabel={canScan ? t("action.scan_a11y") : t("action.checkin_a11y")}
            onPress={openCheckin}
          />
        ) : null}
        {canBroadcast ? (
          <EventActionRow
            icon={iconMap.Megaphone}
            label={t("action.quick_message")}
            accessibilityLabel={t("action.quick_message_a11y")}
            onPress={openBroadcast}
          />
        ) : null}
        {canManageTickets ? (
          <EventActionRow
            icon={iconMap.UserPlus}
            label={t("action.walkup")}
            accessibilityLabel={t("action.walkup_a11y")}
            onPress={() => setWalkupOpen(true)}
          />
        ) : null}
        {canManageTeam ? (
          <EventActionRow
            icon={iconMap.Users}
            label={t("action.team")}
            accessibilityLabel={t("action.team_a11y")}
            onPress={openTeam}
          />
        ) : null}
      </EventActionRows>

      {canViewRoster ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("roster.heading")}</Text>
          <EventRosterBlock cleanupId={id} canCheckIn={canCheckIn} />
        </View>
      ) : null}

      <HostWalkupSheet
        visible={walkupOpen}
        cleanupId={id}
        ticketTypes={cleanup.data.ticketTypes}
        onClose={() => setWalkupOpen(false)}
      />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  section: {
    gap: t.space["2"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
  },
}))
