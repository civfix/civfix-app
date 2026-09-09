import React from "react"
import { View } from "react-native"
import { type ReportStatus } from "@civfix/shared"
import { makeThemedStyles, useTheme, type Theme } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { citizenStatusLabel } from "./report-timeline-labels"

type Tone = { fg: string; bg: string }

export { citizenStatusLabel as citizenReportStatusLabel } from "./report-timeline-labels"

function toneFor(status: ReportStatus, th: Theme): Tone {
  switch (status) {
    case "resolved":
      return { fg: th.colors.moss["700"], bg: th.colors.moss["50"] }
    case "in_progress":
    case "acknowledged":
      return { fg: th.colors.sun["700"], bg: th.colors.sun["50"] }
    case "rejected":
      return { fg: th.colors.bloom["700"], bg: th.colors.bloom["50"] }
    case "submitted":
    case "published":
    case "held":
    default:
      return { fg: th.colors.textMuted, bg: th.colors.bgAlt }
  }
}

export function StatusBadge({ status, large = false }: { status: ReportStatus; large?: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const tone = toneFor(status, th)
  return (
    <View style={[styles.badge, large ? styles.badgeLarge : null, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text variant="caption" color={tone.fg} style={styles.label}>
        {citizenStatusLabel(t, status)}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: t.space["2"],
    paddingVertical: 3,
    borderRadius: t.radius.pill,
  },
  badgeLarge: {
    paddingHorizontal: t.space["3"],
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
}))
