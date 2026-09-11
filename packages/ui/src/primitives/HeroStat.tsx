import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../theme"
import { useLocale } from "../i18n"
import { Text } from "../typography"
import { Meter } from "./Meter"
import { SectionCard } from "./SectionCard"
import { formatStatValue } from "./statTileModel"
import type { StatTone } from "./StatTile"

export interface HeroStatProps {
  label: string
  value: number
  limit: number | null
  limitLabel: string
  caption?: string
  tone?: StatTone
  compact?: boolean
}

export function HeroStat({
  label,
  value,
  limit,
  limitLabel,
  caption,
  tone = "neutral",
  compact = false,
}: HeroStatProps) {
  const styles = useStyles()
  const { locale } = useLocale()
  const shown = formatStatValue(value, locale) ?? String(value)
  return (
    <SectionCard>
      <View style={styles.root}>
        <Text variant="label">{label}</Text>
        <View style={styles.figure}>
          <Text
            style={[
              styles.value,
              compact ? styles.valueCompact : null,
              tone === "success" ? styles.valueSuccess : null,
              tone === "danger" ? styles.valueDanger : null,
            ]}
            numberOfLines={1}
          >
            {shown}
          </Text>
          <Text variant="label" style={styles.limitLabel} numberOfLines={2}>
            {limitLabel}
          </Text>
        </View>
        {limit === null ? null : (
          <Meter value={value} max={limit} accessibilityLabel={`${label}: ${shown} ${limitLabel}`} />
        )}
        {caption ? (
          <Text variant="caption" style={styles.caption}>
            {caption}
          </Text>
        ) : null}
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["2"],
  },
  figure: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: t.space["2"],
  },
  value: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["48"],
    lineHeight: 52,
    letterSpacing: -1,
    color: t.colors.text,
  },
  valueCompact: {
    fontSize: t.fontSize["38"],
    lineHeight: 42,
  },
  valueSuccess: {
    color: t.colors.successInk,
  },
  valueDanger: {
    color: t.colors.dangerInk,
  },
  limitLabel: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    textAlign: "right",
  },
}))
