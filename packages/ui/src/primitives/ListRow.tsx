import React from "react"
import { Pressable, View } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  space,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Icon, Text, iconMap, type IconName } from "../typography"

export const LIST_TILE = 40
export const LIST_ROW_MIN_HEIGHT = 56
export const LIST_DIVIDER_INSET = space["4"] + LIST_TILE + space["3"]

export type IconTileTone = "neutral" | "attention" | "success"

export interface IconTileProps {
  icon: IconName
  tone?: IconTileTone
}

export function IconTile({ icon, tone = "neutral" }: IconTileProps) {
  const styles = useStyles()
  const t = useTheme()
  const ink =
    tone === "attention"
      ? t.colors.sun["700"]
      : tone === "success"
        ? t.colors.successInk
        : t.colors.textMuted
  return (
    <View
      style={[
        styles.tile,
        tone === "attention" ? styles.tileAttention : null,
        tone === "success" ? styles.tileSuccess : null,
      ]}
    >
      <Icon icon={iconMap[icon]} size={18} color={ink} />
    </View>
  )
}

export interface ListRowProps {
  leading?: React.ReactNode
  title: string
  titleLines?: 1 | 2
  sub?: React.ReactNode
  trailing?: React.ReactNode
  onPress?: () => void
  chevron?: boolean
  accessibilityLabel?: string
  testID?: string
}

export function ListRow({
  leading,
  title,
  titleLines,
  sub,
  trailing,
  onPress,
  chevron,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const styles = useStyles()
  const t = useTheme()
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={titleLines ?? 2}>
          {title}
        </Text>
        {typeof sub === "string" ? (
          <Text variant="caption" numberOfLines={1}>
            {sub}
          </Text>
        ) : (
          (sub ?? null)
        )}
      </View>
      {trailing ? (
        <View style={styles.trailing}>
          {typeof trailing === "string" ? (
            <Text style={styles.rowValue} numberOfLines={1}>
              {trailing}
            </Text>
          ) : (
            trailing
          )}
        </View>
      ) : null}
      {chevron ? (
        <Icon icon={iconMap.ChevronRight} size={18} color={t.colors.textSubtle} />
      ) : null}
    </>
  )

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursor(),
        webHover(state) ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["4"],
  },
  pressed: {
    backgroundColor: t.colors.bgAlt,
  },
  hovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  leading: {
    width: LIST_TILE,
    height: LIST_TILE,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
    color: t.colors.text,
  },
  trailing: {
    flexShrink: 0,
  },
  rowValue: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.text,
  },
  tile: {
    width: LIST_TILE,
    height: LIST_TILE,
    borderRadius: t.radius.md,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  tileAttention: {
    backgroundColor: t.colors.sun["50"],
  },
  tileSuccess: {
    backgroundColor: t.colors.successWash,
  },
}))
