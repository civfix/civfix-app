import React from "react"
import { Platform, Pressable, View, type View as RNView, type ViewStyle } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  radius,
  stopPress,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Icon, iconMap } from "../typography"
import { POST_CARD_RHYTHM } from "../bodies/postCardRhythm"

const RHYTHM = POST_CARD_RHYTHM
const IS_WEB = Platform.OS === "web"

const WEB_MORE_TARGET_GROWTH = (RHYTHM.overflowTarget - RHYTHM.overflowBoxHeight) / 2

export const POST_OVERFLOW_ROW_LIFT: ViewStyle = IS_WEB ? { zIndex: 1 } : {}

const WEB_MORE_TARGET: ViewStyle = IS_WEB
  ? {
      height: RHYTHM.overflowTarget,
      marginTop: -WEB_MORE_TARGET_GROWTH,
      marginBottom: -WEB_MORE_TARGET_GROWTH,
      borderRadius: radius.pill,
    }
  : {}

const WEB_MENU_TRIGGER_PROPS = IS_WEB ? ({ "aria-haspopup": "menu" } as object) : null

const WEB_MORE_HALO_TOP: ViewStyle = IS_WEB
  ? { top: (RHYTHM.overflowTarget - RHYTHM.overflowHalo) / 2 }
  : {}

export interface PostOverflowButtonProps {
  label: string
  onPress: () => void
  buttonRef: React.Ref<RNView>
  expanded: boolean
}

export function PostOverflowButton({ label, onPress, buttonRef, expanded }: PostOverflowButtonProps) {
  const styles = useStyles()
  const th = useTheme()
  const buttonStyle = React.useMemo(
    () => [styles.moreButton, WEB_MORE_TARGET, webCursor(false)],
    [styles],
  )
  return (
    <Pressable
      ref={buttonRef}
      onPress={(event) => {
        stopPress(event)
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      {...WEB_MENU_TRIGGER_PROPS}
      hitSlop={8}
      {...focusRingProps}
      style={buttonStyle}
    >
      {(state) => (
        <>
          <View
            style={[
              styles.moreHalo,
              WEB_MORE_HALO_TOP,
              webTransition,
              state.pressed ? styles.moreHaloPressed : webHover(state) ? styles.moreHaloHovered : null,
            ]}
          />
          <Icon icon={iconMap.Ellipsis} size={RHYTHM.overflowGlyph} color={th.colors.textMuted} />
        </>
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  moreButton: {
    width: RHYTHM.overflowTarget,
    height: RHYTHM.overflowBoxHeight,
    marginRight: -RHYTHM.overflowOverhang,
    alignItems: "center",
    justifyContent: "center",
  },
  moreHalo: {
    position: "absolute",
    left: RHYTHM.overflowHaloLeft,
    top: RHYTHM.overflowHaloTop,
    width: RHYTHM.overflowHalo,
    height: RHYTHM.overflowHalo,
    borderRadius: RHYTHM.overflowHalo / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  moreHaloHovered: {
    backgroundColor: t.colors.sky["50"],
  },
  moreHaloPressed: {
    backgroundColor: t.colors.sky["100"],
  },
}))
