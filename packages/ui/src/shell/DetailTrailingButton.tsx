import React from "react"
import { Pressable, View } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../theme"
import { Icon, iconMap } from "../typography"
import { UnreadDot } from "../primitives/UnreadDot"
import { useHasUnreadNotifications } from "../data"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import {
  DETAIL_ACTION_HIT_SLOP,
  DETAIL_ACTION_ICON_SIZE,
  DETAIL_ACTION_RADIUS,
  DETAIL_ACTION_SIZE,
} from "./detailHeader"
import type { DetailTrailingAction } from "./detailTrailingAction"

export interface DetailTrailingButtonsProps {
  actions: readonly DetailTrailingAction[]
}

export function DetailTrailingButtons({ actions }: DetailTrailingButtonsProps) {
  const styles = useStyles()
  if (actions.length === 0) return null
  return (
    <View style={styles.group}>
      {actions.map((action) => (
        <DetailTrailingButton key={action.a11yKey} action={action} />
      ))}
    </View>
  )
}

function DetailTrailingButton({ action }: { action: DetailTrailingAction }) {
  const styles = useStyles()
  const th = useTheme()
  const push = useNavStore((s) => s.push)
  const { t } = useT("nav")
  const { t: tn } = useT("notifications")
  const unread = useHasUnreadNotifications()
  const dot = action.unreadDot === true && unread
  const label = t(action.a11yKey)
  return (
    <View>
      <Pressable
        onPress={() => push(action.push)}
        accessibilityRole="button"
        accessibilityLabel={dot ? tn("row.unreadSuffix", { title: label }) : label}
        hitSlop={DETAIL_ACTION_HIT_SLOP}
        {...focusRingProps}
        style={(state) => [
          styles.chip,
          webCursor(),
          webTransition,
          webHover(state) ? styles.chipHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap[action.icon]} size={DETAIL_ACTION_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      {dot ? <UnreadDot /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
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
