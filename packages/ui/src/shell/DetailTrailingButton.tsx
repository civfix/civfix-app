import React from "react"
import { Pressable } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, webHover, webTransition } from "../theme"
import { Icon, iconMap } from "../typography"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import {
  DETAIL_ACTION_HIT_SLOP,
  DETAIL_ACTION_ICON_SIZE,
  DETAIL_ACTION_RADIUS,
  DETAIL_ACTION_SIZE,
} from "./detailHeader"
import type { DetailTrailingAction } from "./detailTrailingAction"

export interface DetailTrailingButtonProps {
  action: DetailTrailingAction | null
}

export function DetailTrailingButton({ action }: DetailTrailingButtonProps) {
  const styles = useStyles()
  const th = useTheme()
  const push = useNavStore((s) => s.push)
  const { t } = useT("nav")
  if (!action) return null
  return (
    <Pressable
      onPress={() => push(action.push)}
      accessibilityRole="button"
      accessibilityLabel={t(action.a11yKey)}
      hitSlop={DETAIL_ACTION_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webTransition,
        webHover(state) ? styles.chipHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Icon icon={iconMap[action.icon]} size={DETAIL_ACTION_ICON_SIZE} color={th.colors.text} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  chip: {
    width: DETAIL_ACTION_SIZE,
    height: DETAIL_ACTION_SIZE,
    borderRadius: DETAIL_ACTION_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.glass.sheet.input,
  },
  chipHovered: { backgroundColor: t.colors.surfaceTint },
  pressed: { opacity: 0.82, transform: [{ scale: 0.93 }] },
}))
