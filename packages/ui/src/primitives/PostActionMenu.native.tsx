import React, { useCallback, useEffect, useRef } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type View as NativeView,
} from "react-native"
import { useT } from "../i18n"
import { buildPostActionMenuModel } from "./postActionModel"
import {
  PostActionMenuCard,
  resolvePostActionMenuOrigin,
  resolvePostActionMenuPosition,
  usePostActionMenuStyles,
  usePostActionMenuMotion,
} from "./PostActionMenu.shared"
import type { PostActionMenuProps } from "./PostActionMenu.types"

function focusAccessibilityNode(node: NativeView | null): void {
  const handle = node ? findNodeHandle(node) : null
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle)
}

export function PostActionMenu({
  visible,
  reposted,
  anchorRect,
  reducedMotion,
  returnFocusRef,
  onDismiss,
  onRepost,
  onQuote,
}: PostActionMenuProps) {
  const styles = usePostActionMenuStyles()
  const { t } = useT("common")
  const viewport = useWindowDimensions()
  const motion = usePostActionMenuMotion({ visible, reducedMotion, useNativeDriver: true })
  const firstItemRef = useRef<NativeView | null>(null)
  const items = buildPostActionMenuModel(reposted, {
    repost: t("post_actions.repost"),
    undoRepost: t("post_actions.undo_repost"),
    quote: t("post_actions.quote_post"),
  })

  useEffect(() => {
    if (!visible) return
    return () => focusAccessibilityNode(returnFocusRef.current)
  }, [returnFocusRef, visible])

  const focusFirstItem = useCallback(() => {
    requestAnimationFrame(() => focusAccessibilityNode(firstItemRef.current))
  }, [])
  const position = resolvePostActionMenuPosition(anchorRect, viewport)
  const run = useCallback(
    (action: () => void) => {
      onDismiss()
      action()
    },
    [onDismiss],
  )

  return (
    <Modal
      visible={motion.rendered}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
      onShow={focusFirstItem}
    >
      <View
        style={styles.root}
        accessibilityLabel={t("post_actions.menu_label")}
        accessibilityViewIsModal
        onAccessibilityEscape={onDismiss}
        pointerEvents={motion.exiting ? "none" : "auto"}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("post_actions.menu_dismiss")}
          onPress={onDismiss}
        />
        <PostActionMenuCard
          motion={motion}
          origin={resolvePostActionMenuOrigin(anchorRect, position)}
          position={position}
          menuLabel={t("post_actions.menu_label")}
          items={items}
          firstItemRef={firstItemRef}
          itemFeedback={({ pressed }) => (pressed ? styles.itemPressed : null)}
          onRepost={() => run(onRepost)}
          onQuote={() => run(onQuote)}
        />
      </View>
    </Modal>
  )
}
