import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, motion, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { DETAIL_BACK_SIZE, DETAIL_BACK_RADIUS, DETAIL_BACK_ICON_SIZE, detailTitleStyle } from "./detailHeader"
import { DetailTrailingButton } from "./DetailTrailingButton"
import type { DetailTrailingAction } from "./detailTrailingAction"
import { backPressDecision } from "./pageStackModel"

const BACK_PRESS_WINDOW_MS = motion.pagePop.duration

export interface DetailBarProps {
  title: string
  onBack: () => void
  showBack?: boolean
  leading?: "back" | "close"
  trailingAction?: DetailTrailingAction | null
}

export function DetailBar({
  title,
  onBack,
  showBack = true,
  leading = "back",
  trailingAction = null,
}: DetailBarProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const isClose = leading === "close"
  const lastBackRef = React.useRef<number | null>(null)
  const handleBack = React.useCallback(() => {
    const now = Date.now()
    if (backPressDecision(now, lastBackRef.current, BACK_PRESS_WINDOW_MS) === "ignore") return
    lastBackRef.current = now
    onBack()
  }, [onBack])
  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={isClose ? t("a11y.close") : t("a11y.back")}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Icon
            icon={isClose ? iconMap.Close : iconMap.ArrowLeft}
            size={DETAIL_BACK_ICON_SIZE}
            color={th.colors.text}
          />
        </Pressable>
      ) : null}
      <Text
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
        {...({ "data-civfix-panel-heading": "", tabIndex: -1 } as any)}
      >
        {title}
      </Text>
      <DetailTrailingButton action={trailingAction} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: DETAIL_BACK_SIZE,
  },
  back: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["2"],
  },
  pressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
  title: { ...detailTitleStyle(16, t), flex: 1 },
}))
