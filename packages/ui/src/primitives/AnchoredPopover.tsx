import React, { useCallback, useState } from "react"
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { makeThemedStyles, webScrimProps } from "../theme"
import { menuCardStyle, menuScrimStyle, type MenuMotion } from "./menuMotion"
import type { MenuOrigin } from "./menuMotionModel"

export interface AnchoredPopoverProps {
  motion: MenuMotion
  origin: MenuOrigin
  onClose: () => void
  onDismiss?: () => void
  dismissLabel: string
  centered?: boolean
  cardStyle?: StyleProp<ViewStyle>
  onCardLayout?: (event: LayoutChangeEvent) => void
  accessibilityRole?: AccessibilityRole
  children: React.ReactNode
}

export interface MenuCardSize {
  width: number
  height: number
}

export function useMenuCardSize(): {
  size: MenuCardSize | null
  onLayout: (event: LayoutChangeEvent) => void
  reset: () => void
} {
  const [size, setSize] = useState<MenuCardSize | null>(null)
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((prev) =>
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    )
  }, [])
  const reset = useCallback(() => setSize(null), [])
  return { size, onLayout, reset }
}

export function AnchoredPopover({
  motion,
  origin,
  onClose,
  onDismiss,
  dismissLabel,
  centered = false,
  cardStyle,
  onCardLayout,
  accessibilityRole,
  children,
}: AnchoredPopoverProps) {
  const styles = useStyles()
  return (
    <Modal
      visible={motion.rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View
        style={centered ? styles.rootCentered : styles.rootAnchored}
        pointerEvents={motion.exiting ? "none" : "auto"}
      >
        <Animated.View pointerEvents="none" style={[styles.backdrop, menuScrimStyle(motion)]} />
        <Pressable
          style={styles.backdropTouch}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          {...webScrimProps}
        />
        <Animated.View
          onLayout={onCardLayout}
          style={[cardStyle, menuCardStyle(motion, origin)]}
          accessibilityRole={accessibilityRole}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  rootAnchored: {
    flex: 1,
  },
  rootCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
}))
