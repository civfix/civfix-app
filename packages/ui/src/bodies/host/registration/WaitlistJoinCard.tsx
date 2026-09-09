import React from "react"
import { View, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { PrimaryButton } from "../../../primitives/PrimaryButton"
import { useT } from "../../../i18n"

export interface WaitlistJoinCardProps {
  pending: boolean
  onJoin: () => void
  error?: string | null
}

export function WaitlistJoinCard({ pending, onJoin, error }: WaitlistJoinCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon icon={iconMap.Hourglass} size={16} color={th.colors.sun["700"]} />
        <Text style={styles.title}>{t("waitlist.title")}</Text>
      </View>
      <Text style={styles.body}>{t("waitlist.body")}</Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label={t("waitlist.join")} onPress={onJoin} loading={pending} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.sun["50"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.bloom["700"],
  },
}))
