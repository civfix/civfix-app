import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { DonateState } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { openDonate } from "./donateTarget"

export interface DonateBlockOrg {
  slug: string
  displayName: string
  legalName?: string | null
  verified?: boolean
  donateState?: DonateState | null
}

export interface DonateBlockProps {
  org: DonateBlockOrg
  eventId?: string | null
  variant?: "card" | "row"
}

export function DonateBlock({ org, eventId, variant = "card" }: DonateBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("donations")
  const openExternal = useOpenExternal()

  const onPress = useCallback(() => {
    openDonate({ orgSlug: org.slug, eventId: eventId ?? null, openExternal })
  }, [eventId, openExternal, org.slug])

  if (org.donateState !== "READY") return null

  const recipient = org.legalName?.trim() || org.displayName

  if (variant === "row") {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("block.cta_a11y", { org: recipient })}
        {...focusRingProps}
        style={(state) => [
          styles.row,
          webTransition,
          webCursor(),
          webHover(state) ? styles.rowHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.HandHeart} size={16} color={th.colors.bloom["700"]} />
        <View style={styles.rowMeta}>
          <Text style={styles.rowLabel}>{t("block.cta", { org: recipient })}</Text>
          <Text style={styles.mor}>{t("block.merchant_of_record", { org: recipient })}</Text>
        </View>
        <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
      </Pressable>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon icon={iconMap.HandHeart} size={18} color={th.colors.bloom["700"]} />
        <Text style={styles.title}>{t("block.heading")}</Text>
      </View>
      <Text style={styles.body}>{t("block.body", { org: recipient })}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("block.cta_a11y", { org: recipient })}
        {...focusRingProps}
        style={(state) => [
          styles.cta,
          webTransition,
          webCursor(),
          webHover(state) ? styles.ctaHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.ctaLabel}>{t("block.cta", { org: recipient })}</Text>
      </Pressable>
      <Text style={styles.mor}>{t("block.merchant_of_record", { org: recipient })}</Text>
      <Text style={styles.mor}>{t("block.fee_note")}</Text>
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
  cta: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    paddingHorizontal: t.space["5"],
  },
  ctaHovered: {
    opacity: 0.92,
  },
  ctaLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.onAccent,
  },
  mor: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.85,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
}))
