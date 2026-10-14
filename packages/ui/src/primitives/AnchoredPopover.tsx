import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type LayoutChangeEvent,
  type StyleProp,
  type View as NativeView,
  type ViewStyle,
} from "react-native"
import { makeThemedStyles, webScrimProps } from "../theme"
import { menuCardStyle, menuScrimStyle, type MenuMotion } from "./menuMotion"
import type { MenuOrigin } from "./menuMotionModel"

const MOVES_ACCESSIBILITY_FOCUS = Platform.OS !== "web"

type AccessibilityFocusTarget = Parameters<typeof findNodeHandle>[0] | undefined

function focusAccessibilityNode(node: AccessibilityFocusTarget): void {
  if (!MOVES_ACCESSIBILITY_FOCUS || node == null) return
  const handle = findNodeHandle(node)
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
}

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
  accessibilityLabel?: string
  returnFocusRef?: React.RefObject<NativeView | null>
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
  accessibilityLabel,
  returnFocusRef,
  children,
}: AnchoredPopoverProps) {
  const styles = useStyles()
  const cardRef = useRef<NativeView | null>(null)
  const focusRequestRef = useRef<number | null>(null)
  const cancelPendingFocus = useCallback(() => {
    if (focusRequestRef.current == null) return
    cancelAnimationFrame(focusRequestRef.current)
    focusRequestRef.current = null
  }, [])
  const focusCard = useCallback(() => {
    if (!MOVES_ACCESSIBILITY_FOCUS) return
    cancelPendingFocus()
    focusRequestRef.current = requestAnimationFrame(() => {
      focusRequestRef.current = null
      focusAccessibilityNode(cardRef.current)
    })
  }, [cancelPendingFocus])

  // The trigger is read at close time, not open time: a trigger that re-mounted while the popover was
  // up gets the focus, and one that unmounted with its owner is null, which focuses nothing.
  const returnFocus = useCallback(() => {
    cancelPendingFocus()
    focusAccessibilityNode(returnFocusRef?.current)
  }, [cancelPendingFocus, returnFocusRef])

  const rendered = motion.rendered
  useEffect(() => {
    if (!rendered) return
    return returnFocus
  }, [rendered, returnFocus])

  return (
    <Modal
      visible={motion.rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={focusCard}
      onDismiss={onDismiss}
    >
      <View
        style={centered ? styles.rootCentered : styles.rootAnchored}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
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
          ref={cardRef}
          onLayout={onCardLayout}
          style={[cardStyle, menuCardStyle(motion, origin)]}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
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
