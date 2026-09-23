import React, { useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { PrimaryButton } from "./PrimaryButton"
import { openDonate } from "./donateTarget"
import { donationUrlHost, safeDonationUrl } from "./donationUrl"

export interface DonateBlockProps {
  url: string | null | undefined
  ownerName: string
}

export function DonateBlock({ url, ownerName }: DonateBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("donation-link")
  const openExternal = useOpenExternal()
  const safeUrl = safeDonationUrl(url)

  const onPress = useCallback(() => {
    if (!safeUrl) return
    openDonate({ url: safeUrl, openExternal })
  }, [openExternal, safeUrl])

  if (!safeUrl) return null

  const host = donationUrlHost(safeUrl)
  const supports = t("card.supports", { name: ownerName })
  const openLabel = t("card.open_a11y", { name: ownerName, host })

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon icon={iconMap.HandHeart} size={18} color={th.colors.bloom["700"]} />
        <Text style={styles.title}>{t("card.title")}</Text>
      </View>
      <Text style={styles.body}>{supports}</Text>
      <PrimaryButton
        label={t("card.open")}
        icon={iconMap.ExternalLink}
        onPress={onPress}
        accessibilityLabel={openLabel}
      />
      <View style={styles.hostRow}>
        <Icon icon={iconMap.ExternalLink} size={12} color={th.colors.textSubtle} />
        <Text style={styles.host} numberOfLines={1}>
          {host}
        </Text>
      </View>
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
    backgroundColor: t.colors.surface,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  host: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
}))
