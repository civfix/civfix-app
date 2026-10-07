import React, { useCallback } from "react"
import { View } from "react-native"
import type { LinkedEventRef } from "@civfix/shared"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { EventCard } from "../../primitives"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { linkedEventToCleanup } from "../reportDetailModel"
import { useReportDetailSharedStyles } from "./sharedStyles"

export function ReportLinkedEvents({ events }: { events: LinkedEventRef[] }) {
  const styles = useStyles()
  const shared = useReportDetailSharedStyles()
  const { t } = useT("report-detail")
  const onOpenEvent = useCallback((ev: LinkedEventRef) => {
    useNavStore.getState().push({ kind: "cleanup", id: ev.id, title: ev.title, lat: ev.lat, lng: ev.lng })
  }, [])

  if (events.length === 0) return null
  return (
    <View style={styles.linkedSection}>
      <Text style={shared.eyebrow}>{t("linked_events.heading")}</Text>
      <View style={styles.linkedList}>
        {events.map((ev) => (
          <EventCard key={ev.id} cleanup={linkedEventToCleanup(ev)} onPress={() => onOpenEvent(ev)} />
        ))}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  linkedSection: {
    marginTop: t.space["5"],
  },
  linkedList: {
    gap: t.space["3"],
  },
}))
