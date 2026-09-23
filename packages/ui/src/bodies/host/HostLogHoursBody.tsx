import React, { useCallback } from "react"
import { View } from "react-native"
import { nextEventBoundaryMs, hasEventEnded } from "@civfix/shared/host"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import {
  cleanupHostStanding,
  managesEvent,
  useAuthState,
  useCleanup,
  useEventHours,
  useNow,
  NOW_TICK_MS,
} from "../../data"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { LogHoursEditor } from "../LogHoursEditor"
import { hostLogHoursGate } from "./hostLogHoursGate"

export function HostLogHoursBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const { ScrollView } = useScrollHost()

  const cleanup = useCleanup(id)
  const viewerId = useAuthState().user?.id ?? null
  const event = cleanup.data ?? null
  const manages = event !== null && managesEvent(cleanupHostStanding(event, viewerId))
  // A non-manager's hours request can only 403, which would surface as an error ahead of the
  // denied state; an undefined id keeps the query disabled.
  const hours = useEventHours(manages ? id : undefined)

  const boundaryAt = event === null ? null : nextEventBoundaryMs(event, Date.now())
  const now = useNow(boundaryAt === null ? 0 : NOW_TICK_MS, { boundaryAt })

  const onClose = useCallback(() => {
    useNavStore.getState().back()
  }, [])

  const gate = hostLogHoursGate({
    loading: cleanup.isLoading || hours.isLoading,
    failed: cleanup.isError || hours.isError || event === null,
    manages,
    ended: event !== null && hasEventEnded(event, now),
  })

  if (gate === "loading") {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (gate === "error" || event === null) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (gate === "denied") {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="Lock"
          title={t("state.no_access_title")}
          body={t("state.no_access_body")}
        />
      </View>
    )
  }

  if (gate === "not-yet") {
    return (
      <View style={styles.fill}>
        <FeedNotice
          plain
          icon="Clock"
          title={t("hours.not_yet_title")}
          body={t("hours.not_yet_body")}
        />
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
      <LogHoursEditor
        cleanupId={id}
        cleanup={event}
        initialEntries={hours.data?.entries ?? []}
        openOnMount
        onClose={onClose}
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
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
}))
