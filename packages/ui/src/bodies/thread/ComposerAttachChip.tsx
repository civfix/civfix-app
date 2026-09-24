/**
 * A full `LinkedEventCard` / `LinkedReportCard` (72pt+ each, two of them possible) does not fit a
 * height-budgeted dock that also holds a mode strip, the field and the tools row, and pushes the Reply
 * button off-screen. The attachment only has to answer "what is attached, and how do I remove it", so it
 * collapses to one 44pt line: [glyph][title][x].
 *
 * Presentation-only: the composer owns what is attached and what removing it does.
 */
import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { useT } from "../../i18n"

export interface ComposerAttachChipProps {
  /** Which glyph leads the chip: a calendar for an event, a map pin for a report. */
  kind: "event" | "report"
  /** The attached thing's title (ellipsized to one line). */
  title: string
  onRemove: () => void
}

export function ComposerAttachChip({ kind, title, onRemove }: ComposerAttachChipProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("post-composer")
  return (
    <View style={styles.chip}>
      <Icon
        icon={kind === "event" ? iconMap.Calendar : iconMap.MapPin}
        size={16}
        color={th.colors.accent}
      />
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(kind === "event" ? "reply.remove_event_a11y" : "reply.remove_report_a11y")}
        onPress={onRemove}
        hitSlop={8}
        {...focusRingProps}
        style={({ pressed }) => [styles.remove, pressed ? styles.removePressed : null]}
      >
        <Icon icon={iconMap.Close} size={14} color={th.colors.textMuted} />
      </Pressable>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  chip: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingLeft: t.space["3"],
    paddingRight: t.space["1"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: t.colors.text,
  },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  removePressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
}))
