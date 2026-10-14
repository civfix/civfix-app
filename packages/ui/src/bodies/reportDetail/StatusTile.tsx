import React from "react"
import { View } from "react-native"
import { useTheme, type Theme } from "../../theme"
import { Text, Icon, iconMap, type IconName } from "../../typography"
import { useT } from "../../i18n"
import { useGalleryStyles } from "./galleryStyles"

export type StatusTileKind = "processing" | "rejected" | "held"

const statusTile = (t: Theme): Record<StatusTileKind, { icon: IconName; labelKey: string; color: string }> => ({
  processing: { icon: "Clock", labelKey: "gallery.tile_processing", color: t.colors.textSubtle },
  rejected: { icon: "Ban", labelKey: "gallery.tile_rejected", color: t.colors.brand.bloom },
  held: { icon: "AlertCircle", labelKey: "gallery.tile_held", color: t.colors.brand.sun },
})

export function StatusTile({ kind, variant }: { kind: StatusTileKind; variant: "hero" | "thumb" }) {
  const styles = useGalleryStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const { icon, labelKey, color } = statusTile(th)[kind]
  const label = t(labelKey)
  if (variant === "thumb") {
    return (
      <View style={[styles.thumb, styles.thumbStatus]} accessible accessibilityRole="image" accessibilityLabel={label}>
        <Icon icon={iconMap[icon]} size={16} color={color} />
      </View>
    )
  }
  return (
    <View style={styles.statusHero}>
      <Icon icon={iconMap[icon]} size={26} color={color} />
      <Text style={styles.statusHeroText}>{label}</Text>
    </View>
  )
}
