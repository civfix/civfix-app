import React from "react"
import { View, StyleSheet } from "react-native"
import type { ChatMessageDTO, ReportStatus } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { citizenStatusLabel, kindForStatus, NODE_GLYPH, nodeColor } from "./report-timeline-labels"
import { visibilityKindOf } from "./report-timeline-model"

export const SystemMessageRow = React.memo(function SystemMessageRow({ message }: { message: ChatMessageDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const sys = message.system ?? null
  const status = (sys?.status ?? "") as ReportStatus
  const visibility = visibilityKindOf(sys?.kind)
  const replyBody = sys?.kind === "reply" ? (sys.body ?? "").trim() : ""
  if (replyBody) {
    const replyColor = nodeColor("forwarded", th.scheme)
    return (
      <View style={styles.row} accessibilityRole="text">
        <View style={styles.reply}>
          <View style={styles.replyHead}>
            <Icon icon={iconMap[NODE_GLYPH.forwarded]} size={12} color={replyColor} />
            <Text style={[styles.text, { color: replyColor }]}>{t("timeline.reply_from_city")}</Text>
          </View>
          <Text style={styles.replyBody}>{replyBody}</Text>
        </View>
      </View>
    )
  }
  const nodeKind = visibility ?? kindForStatus(status)
  const label =
    visibility === "hidden"
      ? t("timeline.hidden_from_map")
      : visibility === "unhidden"
        ? t("timeline.shown_on_map_again")
        : sys?.status
          ? citizenStatusLabel(t, status)
          : (sys?.note ?? sys?.body ?? "")
  const color = nodeColor(nodeKind, th.scheme)
  if (!label) return null
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={styles.pill}>
        <Icon icon={iconMap[NODE_GLYPH[nodeKind]]} size={12} color={color} />
        <Text style={[styles.text, { color }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  row: { alignSelf: "center", marginVertical: t.space["2"], maxWidth: "88%" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: t.space["3"],
    paddingVertical: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  text: { fontFamily: t.fontFamily.bodySemiBold, fontSize: 11.5, textAlign: "center" },
  reply: {
    gap: 4,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  replyHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  replyBody: { fontFamily: t.fontFamily.bodyRegular, fontSize: 13, color: t.colors.text },
}))
