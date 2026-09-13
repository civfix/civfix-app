import React, { useCallback } from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { managesEvent, useCleanup, useEventHours } from "../../data"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { LogHoursEditor } from "../LogHoursEditor"

export function HostLogHoursBody({ id }: { id: string }) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const { ScrollView } = useScrollHost()

  const cleanup = useCleanup(id)
  const hours = useEventHours(id)

  const onClose = useCallback(() => {
    useNavStore.getState().back()
  }, [])

  if (cleanup.isLoading || hours.isLoading) {
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

  if (!managesEvent(cleanup.data)) {
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <LogHoursEditor
        cleanupId={id}
        cleanup={cleanup.data}
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
