import React, { useCallback } from "react"
import { nextEventBoundaryMs, hasEventEnded } from "@civfix/shared/host"
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
import { LogHoursEditor } from "../LogHoursEditor"
import { hostLogHoursGate } from "./hostLogHoursGate"
import { HostBodyState, useHostBodyStyles } from "./HostBodyState"
import { HostStateNotice } from "./HostStateNotice"

export function HostLogHoursBody({ id }: { id: string }) {
  const styles = useHostBodyStyles()
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
    return <HostBodyState state="loading" t={t} />
  }

  if (gate === "error" || event === null) {
    return <HostBodyState state="error" t={t} />
  }

  if (gate === "denied") {
    return (
      <HostStateNotice icon="Lock" title={t("state.no_access_title")} body={t("state.no_access_body")} />
    )
  }

  if (gate === "not-yet") {
    return <HostStateNotice icon="Clock" title={t("hours.not_yet_title")} body={t("hours.not_yet_body")} />
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
