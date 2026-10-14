import React from "react"
import { Modal, View, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { makeThemedStyles, space, useTheme, webScrimProps } from "../theme"
import type { AnchorRect } from "./PopoverMenu"
import { menuSurfaceStyle } from "./menuSurface"
import { resolveBandLeft } from "./messageContextMenuLayout"
import { useDeferredOverlayAction } from "./useDeferredOverlayAction"
import { useModalClosed } from "./useModalClosed"

export type RunAfterDismiss = (action: () => void) => void

export interface AnchoredActionSheetProps {
  visible: boolean
  onClose: () => void
  anchor?: AnchorRect | null
  cardWidth: number
  cardMaxWidth: number
  dismissLabel: string
  children: (runAfterDismiss: RunAfterDismiss) => React.ReactNode
}

const EDGE_MARGIN = space["2"]
const GAP = space["1"]

/**
 * Web: a card pinned above the trigger. Native: a bottom sheet. Row actions go through `runAfterDismiss`
 * so an iOS picker is presented only once this Modal has finished tearing down.
 */
export function AnchoredActionSheet({
  visible,
  onClose,
  anchor,
  cardWidth,
  cardMaxWidth,
  dismissLabel,
  children,
}: AnchoredActionSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const insets = React.useContext(SafeAreaInsetsContext)

  const { run, settled } = useDeferredOverlayAction(visible, onClose, undefined)
  const onModalDismiss = useModalClosed(visible, settled)
  // Registered rather than inline so react-native-web emits the same atomic classes as a themed style.
  const cardSize = React.useMemo(
    () => StyleSheet.create({ size: { minWidth: cardWidth, maxWidth: cardMaxWidth } }).size,
    [cardWidth, cardMaxWidth],
  )
  const content = children(run)

  if (Platform.OS === "web") {
    let cardPosition: { bottom: number; left: number } | null = null
    if (anchor) {
      cardPosition = {
        bottom: Math.max(EDGE_MARGIN, winH - anchor.y + GAP),
        left: resolveBandLeft(anchor, winW, cardWidth, false, { edgeMargin: EDGE_MARGIN }),
      }
    }
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        onDismiss={onModalDismiss}
      >
        <View style={styles.rootWeb}>
          <Pressable
            style={styles.backdropWeb}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onClose}
            {...webScrimProps}
          />
          <View
            style={[
              styles.card,
              cardSize,
              cardPosition ? { position: "absolute", ...cardPosition } : styles.cardCentered,
            ]}
            accessibilityRole="menu"
          >
            {content}
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <View style={styles.rootNative}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          {...webScrimProps}
        />
        <View
          style={[styles.sheet, { paddingBottom: (insets?.bottom ?? 0) + th.space["3"] }]}
          accessibilityRole="menu"
        >
          {content}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  rootWeb: {
    flex: 1,
  },
  backdropWeb: {
    ...StyleSheet.absoluteFillObject,
  },
  rootNative: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  card: menuSurfaceStyle(t),
  cardCentered: {
    alignSelf: "center",
    marginTop: "auto",
    marginBottom: "auto",
  },
  sheet: {
    paddingTop: t.space["2"],
    paddingHorizontal: t.space["2"],
    borderTopLeftRadius: t.radius.xl,
    borderTopRightRadius: t.radius.xl,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
}))
