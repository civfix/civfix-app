import React, { useEffect, useMemo, useRef } from "react"
import { Modal, Pressable, useWindowDimensions, View, type View as NativeView } from "react-native"
import { webCursor, webHover, webTransition, webScrimProps } from "../theme"
import { useT } from "../i18n"
import { buildPostActionMenuModel } from "./postActionModel"
import {
  createPostActionMenuWebController,
  handlePostActionMenuWebKey,
  postActionMenuAccessibility,
} from "./PostActionMenu.webBehavior"
import {
  PostActionMenuCard,
  resolvePostActionMenuOrigin,
  resolvePostActionMenuPosition,
  usePostActionMenuStyles,
  usePostActionMenuMotion,
} from "./PostActionMenu.shared"
import type { PostActionMenuProps } from "./PostActionMenu.types"

type Focusable = NativeView & { focus?: () => void }

function focusNode(node: NativeView | null): void {
  const focusable = node as Focusable | null
  focusable?.focus?.()
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
  const motion = usePostActionMenuMotion({ visible, reducedMotion, useNativeDriver: false })
  const firstItemRef = useRef<NativeView | null>(null)
  const lastItemRef = useRef<NativeView | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const items = buildPostActionMenuModel(reposted, {
    repost: t("post_actions.repost"),
    undoRepost: t("post_actions.undo_repost"),
    quote: t("post_actions.quote_post"),
  })
  const semantics = useMemo(
    () =>
      postActionMenuAccessibility({
        menu: t("post_actions.menu_label"),
        dismiss: t("post_actions.menu_dismiss"),
      }),
    [t],
  )
  const controllerCallbacksRef = useRef({ onDismiss, returnFocusRef })
  controllerCallbacksRef.current = { onDismiss, returnFocusRef }
  const controllerRef = useRef<ReturnType<typeof createPostActionMenuWebController> | null>(null)
  if (controllerRef.current == null) {
    controllerRef.current = createPostActionMenuWebController({
      onDismiss: () => controllerCallbacksRef.current.onDismiss(),
      focusInitialItem: () => focusNode(firstItemRef.current),
      restoreTriggerFocus: () => {
        const returnTarget = controllerCallbacksRef.current.returnFocusRef.current ?? previousFocusRef.current
        focusNode(returnTarget as NativeView | null)
      },
      scheduler: {
        request: (callback) => window.requestAnimationFrame(callback),
        cancel: (request) => window.cancelAnimationFrame(request),
      },
    })
  }
  const controller = controllerRef.current

  useEffect(() => {
    if (!visible || typeof window === "undefined" || typeof document === "undefined") return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    controller.open()
    const onKeyDown = (event: KeyboardEvent) => {
      const first = firstItemRef.current as unknown as HTMLElement | null
      const last = lastItemRef.current as unknown as HTMLElement | null
      const activeIndex = document.activeElement === first ? 0 : document.activeElement === last ? 1 : -1
      handlePostActionMenuWebKey({
        event,
        activeIndex,
        itemCount: items.length,
        onDismiss: controller.dismiss,
        onFocus: (focusIndex) => {
          if (focusIndex === 0) first?.focus()
          else last?.focus()
        },
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      controller.close()
    }
  }, [controller, items.length, visible])

  const position = resolvePostActionMenuPosition(anchorRect, viewport)
  const run = (action: () => void) => {
    controller.dismiss()
    action()
  }

  return (
    <Modal visible={motion.rendered} transparent animationType="none" onRequestClose={controller.dismiss}>
      <View
        style={styles.root}
        role={semantics.dialog.role}
        accessibilityLabel={semantics.dialog.label}
        accessibilityViewIsModal={semantics.dialog.accessibilityViewIsModal}
        aria-modal={semantics.dialog.ariaModal}
        onAccessibilityEscape={controller.dismiss}
        pointerEvents={motion.exiting ? "none" : "auto"}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole={semantics.backdrop.role}
          accessibilityLabel={semantics.backdrop.label}
          onPress={controller.dismissFromBackdrop}
          {...webScrimProps}
        />
        <PostActionMenuCard
          motion={motion}
          origin={resolvePostActionMenuOrigin(anchorRect, position)}
          position={position}
          menuLabel={semantics.menu.label}
          items={items}
          firstItemRef={firstItemRef}
          lastItemRef={lastItemRef}
          itemFeedback={(state) => [
            webTransition,
            webCursor(),
            webHover(state) ? styles.itemHovered : null,
            state.pressed ? styles.itemPressed : null,
          ]}
          onRepost={() => run(onRepost)}
          onQuote={() => run(onQuote)}
        />
      </View>
    </Modal>
  )
}
