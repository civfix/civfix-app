import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { makeThemedStyles, motion, useTheme, webScrimProps } from "../theme"
import { IosKeyboardAvoidingView } from "../shell/IosKeyboardAvoidingView"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"
import { menuScrimStyle, useMenuMotion, type MenuMotionRecipes } from "./menuMotion"
import { useModalClosed } from "./useModalClosed"
import { slideUpDragOffset, slideUpDragOutcome, slideUpShouldCapture } from "./slideUpSheetModel"

export interface SlideUpSheetProps {
  visible: boolean
  onClose: () => void
  onClosed?: () => void
  dismissLabel: string
  accessibilityLabel?: string
  maxHeightRatio?: number
  contentStyle?: StyleProp<ViewStyle>
  children: React.ReactNode
}

const SHEET_RECIPES: MenuMotionRecipes = { enter: motion.sheetMove, exit: motion.sheetDismiss }
const DEFAULT_MAX_HEIGHT_RATIO = 0.9

export function SlideUpSheet({
  visible,
  onClose,
  onClosed,
  dismissLabel,
  accessibilityLabel,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  contentStyle,
  children,
}: SlideUpSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { height: winH } = useWindowDimensions()
  const insets = useContext(SafeAreaInsetsContext)
  const kbReserve = useKeyboardReserve({ enabled: visible })
  const [sheetHeight, setSheetHeight] = useState<number | null>(null)
  const sheetMotion = useMenuMotion({ visible, ready: sheetHeight !== null, recipes: SHEET_RECIPES })
  const { rendered, progress, useNativeDriver } = sheetMotion
  const onModalDismiss = useModalClosed(rendered, onClosed)

  const sheetHeightRef = useRef<number | null>(null)
  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height)
    sheetHeightRef.current = next
    setSheetHeight((prev) => (prev === next ? prev : next))
  }, [])

  const dragY = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!rendered) dragY.setValue(0)
  }, [rendered, dragY])

  const pan = useMemo(() => {
    const settleBack = () => {
      Animated.timing(dragY, {
        toValue: 0,
        duration: motion.sheetMove.duration,
        easing: Easing.bezier(...motion.sheetMove.easing),
        useNativeDriver,
      }).start()
    }
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => slideUpShouldCapture(gesture.dx, gesture.dy),
      onPanResponderMove: (_event, gesture) => dragY.setValue(slideUpDragOffset(gesture.dy)),
      onPanResponderRelease: (_event, gesture) => {
        if (slideUpDragOutcome(gesture.dy, gesture.vy, sheetHeightRef.current) === "dismiss") {
          onCloseRef.current()
          return
        }
        settleBack()
      },
      onPanResponderTerminate: settleBack,
    })
  }, [dragY, useNativeDriver])

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight ?? winH, 0] }),
    dragY,
  )

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <View
        style={styles.root}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        pointerEvents={sheetMotion.exiting ? "none" : "auto"}
      >
        <Animated.View pointerEvents="none" style={[styles.scrim, menuScrimStyle(sheetMotion)]} />
        <Pressable
          style={styles.scrimTouch}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          {...webScrimProps}
        />
        <IosKeyboardAvoidingView
          style={[styles.avoider, kbReserve > 0 ? { paddingBottom: kbReserve } : null]}
        >
          <Animated.View
            onLayout={onSheetLayout}
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.sheet,
              {
                maxHeight: winH * maxHeightRatio,
                paddingBottom: (insets?.bottom ?? 0) + th.space["3"],
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.grabArea} {...pan.panHandlers}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={dismissLabel}
                onPress={onClose}
                hitSlop={th.space["2"]}
                style={styles.grabHandle}
              />
            </View>
            <View style={[styles.content, contentStyle]}>{children}</View>
          </Animated.View>
        </IosKeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  scrimTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  avoider: {
    flex: 1,
    justifyContent: "flex-end",
    pointerEvents: "box-none",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: t.radius["2xl"],
    borderTopRightRadius: t.radius["2xl"],
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  grabArea: {
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["1"],
  },
  grabHandle: {
    width: 36,
    height: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.border,
  },
  content: {
    flexShrink: 1,
    minHeight: 0,
    paddingHorizontal: t.space["4"],
    gap: t.space["3"],
  },
}))
