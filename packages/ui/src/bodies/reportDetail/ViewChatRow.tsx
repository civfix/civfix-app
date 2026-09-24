import React, { useCallback } from "react"
import { View, Pressable } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { useReportDetailSharedStyles } from "./sharedStyles"

export function ViewChatRow({ report }: { report: ReportDTO }) {
  const styles = useStyles()
  const shared = useReportDetailSharedStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const members = report.chatMemberCount ?? 0
  const messages = report.chatMessageCount ?? 0
  const unread = report.chatUnread ?? 0
  const onPress = useCallback(() => {
    useNavStore.getState().push({ kind: "thread", id: report.id, roomKind: "report" })
  }, [report.id])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("chat.view_chat_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [styles.viewChatRow, pressed ? shared.pressed : null]}
    >
      <Icon icon={iconMap.MessageCircle} size={18} color={th.colors.brand.bloom} />
      <View style={styles.viewChatBody}>
        <Text style={styles.viewChatTitle} numberOfLines={1}>
          {t("chat.view_chat")}
        </Text>
        <Text style={styles.viewChatMeta} numberOfLines={1}>
          {t("chat.view_chat_meta", { members, messages })}
        </Text>
      </View>
      {unread > 0 ? <View style={styles.viewChatUnreadDot} /> : null}
      <Icon icon={iconMap.ChevronRight} size={18} color={th.colors.textSubtle} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  viewChatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    marginTop: t.space["4"],
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  viewChatBody: { flex: 1, minWidth: 0 },
  viewChatTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  viewChatMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  viewChatUnreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: t.colors.brand.bloom,
  },
}))
