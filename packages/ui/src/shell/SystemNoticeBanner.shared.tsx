import React, { forwardRef, useMemo } from "react"
import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native"
import { useAppConfig } from "../data/hooks/appConfig"
import { useT } from "../i18n"
import {
  focusRingProps,
  hitSlopToTarget,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
  HOVERED_OPACITY,
  PRESSED_OPACITY,
} from "../theme"
import { Icon, Text, iconMap } from "../typography"
import { useSystemNoticeStore, visibleSystemNotice, type SystemNotice } from "./systemNoticeStore"

const DISMISS_SIZE = 28
const DISMISS_ICON_SIZE = 15

/**
 * The notice to show, or null. Read only through the shared app-config query, which refreshes on start and
 * on a return to the foreground at most every five minutes, and is never restored from a persisted cache:
 * with the API off or failing there is no data, so no bar and no error.
 */
export function useVisibleSystemNotice(): SystemNotice | null {
  const announcement = useAppConfig().data?.announcement
  const dismissedHash = useSystemNoticeStore((s) => s.dismissedHash)
  return useMemo(() => visibleSystemNotice(announcement, dismissedHash), [announcement, dismissedHash])
}

export interface SystemNoticeBarProps {
  notice: SystemNotice
  /** The platform's placement and its safe-area top. */
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  onLayout?: ViewProps["onLayout"]
}

/** The text renders as a plain string: the notice carries no links or formatting (D8). */
export const SystemNoticeBar = forwardRef<View, SystemNoticeBarProps>(function SystemNoticeBar(
  { notice, style, contentStyle, onLayout },
  ref,
) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common")
  const dismiss = useSystemNoticeStore((s) => s.dismiss)
  // The contrast-checked chip pairs: the hue's 50 wash under its chip ink.
  const hue = notice.level === "warning" ? "sun" : "sky"
  const ink = th.colors.chipInk[hue]

  return (
    <View
      ref={ref}
      testID="system-notice"
      onLayout={onLayout}
      style={[{ backgroundColor: th.colors[hue]["50"] }, style]}
    >
      <View style={[styles.row, contentStyle]}>
        <Text variant="label" style={[styles.text, { color: ink }]}>
          {notice.text}
        </Text>
        <Pressable
          onPress={() => dismiss(notice.text)}
          accessibilityRole="button"
          accessibilityLabel={t("dismiss_announcement")}
          hitSlop={hitSlopToTarget(DISMISS_SIZE)}
          {...focusRingProps}
          style={(state) => [
            styles.dismiss,
            webCursor(),
            webTransition,
            webHover(state) ? styles.hovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={DISMISS_ICON_SIZE} color={ink} />
        </Pressable>
      </View>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingLeft: t.space["4"],
    paddingRight: t.space["2"],
    paddingBottom: t.space["1"],
  },
  text: {
    flex: 1,
  },
  dismiss: {
    width: DISMISS_SIZE,
    height: DISMISS_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  hovered: {
    opacity: HOVERED_OPACITY,
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
}))
