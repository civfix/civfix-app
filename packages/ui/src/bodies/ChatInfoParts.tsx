import React from "react"
import { View, Pressable, Image } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, headingLevel } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"

export interface ChatInfoHeroProps {
  imageUrl: string | null
  glyph: IconName
  title: string
  badge?: React.ReactNode
  subtitle: string | null
  subtitleLines?: number
  memberLine: string
  footer?: React.ReactNode
}

export function ChatInfoHero({
  imageUrl,
  glyph,
  title,
  badge,
  subtitle,
  subtitleLines,
  memberLine,
  footer,
}: ChatInfoHeroProps) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.hero}>
      <View style={[styles.heroAvatar, imageUrl ? styles.heroAvatarFramed : null]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.heroAvatarImage} resizeMode="cover" />
        ) : (
          <Icon icon={iconMap[glyph]} size={34} color={th.colors.onAccent} />
        )}
      </View>
      <Text
        style={styles.heroName}
        numberOfLines={2}
        accessibilityRole="header"
        {...headingLevel(2)}
      >
        {title}
      </Text>
      {badge}
      {subtitle ? (
        <Text style={styles.heroSubtitle} numberOfLines={subtitleLines}>
          {subtitle}
        </Text>
      ) : null}
      <Text style={styles.heroMembers}>{memberLine}</Text>
      {footer}
    </View>
  )
}

export function ChatInfoActionRow({
  icon,
  label,
  a11y,
  destructive,
  disabled,
  onPress,
}: {
  icon: IconName
  label: string
  a11y?: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.actionRow,
        pressed ? styles.rowPressed : null,
        disabled ? styles.actionDisabled : null,
      ]}
    >
      <Icon
        icon={iconMap[icon]}
        size={18}
        color={destructive ? th.colors.bloom["600"] : th.colors.text}
      />
      <Text style={[styles.actionLabel, destructive ? styles.actionLabelDestructive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  hero: {
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["4"],
    gap: t.space["2"],
  },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.moss,
  },
  heroAvatarFramed: t.imageFrame,
  heroAvatarImage: {
    width: "100%",
    height: "100%",
  },
  heroName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 19,
    color: t.colors.text,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
    textAlign: "center",
  },
  heroMembers: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"],
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  actionLabelDestructive: {
    color: t.colors.bloom["600"],
  },
  rowPressed: {
    opacity: 0.7,
  },
}))
