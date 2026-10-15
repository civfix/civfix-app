import React from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, type LucideIcon } from "../../typography"

export function FooterButtonContent({
  label,
  icon,
  enabled,
  busy,
}: {
  label: string
  icon: LucideIcon
  enabled: boolean
  busy: boolean
}) {
  const styles = useWizardFooterStyles()
  const th = useTheme()
  const fg = enabled ? th.colors.onAccent : th.colors.textSubtle
  return (
    <>
      <Text style={[styles.nextText, { color: fg }]}>{label}</Text>
      <View style={styles.nextIcon}>
        {busy ? <ActivityIndicator size="small" color={fg} /> : <Icon icon={icon} size={16} color={fg} />}
      </View>
    </>
  )
}

export const useWizardFooterStyles = makeThemedStyles((t) => ({
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["4"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.bg,
  },
  nextBtn: {
    flex: 1,
    height: 50,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextActive: { backgroundColor: t.colors.brand.bloom },
  nextDisabled: { backgroundColor: t.colors.neutral.ink5 },
  nextText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
  },
  nextIcon: { marginLeft: 6 },
}))
