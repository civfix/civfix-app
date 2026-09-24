import React from "react"
import { Modal, View, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import {
  makeThemedStyles,
  space,
  useTheme,
  webCursorPointer,
  webTransition,
  webHover,
  webNoSelect,
  focusRingProps,
  webScrimProps,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import type { AnchorRect } from "./PopoverMenu"
import { composerAttachRows, type ComposerAttachRowKey } from "./composerAttachRows"
import { useDeferredOverlayAction } from "./useDeferredOverlayAction"
import { useModalClosed } from "./useModalClosed"

export interface ComposerAttachSheetProps {
  visible: boolean
  onClose: () => void
  anchor?: AnchorRect | null
  canCreatePoll: boolean
  onPhoto: () => void
  onCamera: () => void
  onPoll: () => void
}

const ROW_ICON: Record<ComposerAttachRowKey, IconName> = {
  photo: "Image",
  camera: "Camera",
  poll: "BarChart3",
}

const CARD_WIDTH = 232
const EDGE_MARGIN = space["2"]
const GAP = space["1"]

export function ComposerAttachSheet({
  visible,
  onClose,
  anchor,
  canCreatePoll,
  onPhoto,
  onCamera,
  onPoll,
}: ComposerAttachSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { width: winW, height: winH } = useWindowDimensions()
  const isWeb = Platform.OS === "web"
  const insets = React.useContext(SafeAreaInsetsContext)

  const rows = composerAttachRows({ isWeb, canCreatePoll })

  const handlerFor = (key: ComposerAttachRowKey): (() => void) =>
    key === "photo" ? onPhoto : key === "camera" ? onCamera : onPoll

  const { run, settled } = useDeferredOverlayAction(visible, onClose, undefined)
  const onModalDismiss = useModalClosed(visible, settled)
  const choose = (key: ComposerAttachRowKey) => run(handlerFor(key))

  const renderRow = (key: ComposerAttachRowKey) => {
    const label = t(`attach.${key}`)
    return (
      <Pressable
        key={key}
        onPress={() => choose(key)}
        accessibilityRole="menuitem"
        accessibilityLabel={label}
        {...focusRingProps}
        style={(state) => [
          styles.row,
          webTransition,
          webCursorPointer,
          webHover(state) ? styles.rowHovered : null,
          state.pressed ? styles.rowPressed : null,
        ]}
      >
        <Icon icon={iconMap[ROW_ICON[key]]} size={18} color={th.colors.text} />
        <Text variant="body" color={th.colors.text} numberOfLines={1} style={[styles.rowLabel, webNoSelect]}>
          {label}
        </Text>
      </Pressable>
    )
  }

  if (isWeb) {
    let cardPosition: { bottom: number; left: number } | null = null
    if (anchor) {
      const rawLeft = anchor.x
      const maxLeft = Math.max(EDGE_MARGIN, winW - CARD_WIDTH - EDGE_MARGIN)
      cardPosition = {
        bottom: Math.max(EDGE_MARGIN, winH - anchor.y + GAP),
        left: Math.min(Math.max(rawLeft, EDGE_MARGIN), maxLeft),
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
            accessibilityLabel={t("attach.dismiss")}
            onPress={onClose}
            {...webScrimProps}
          />
          <View
            style={[styles.card, cardPosition ? { position: "absolute", ...cardPosition } : styles.cardCentered]}
            accessibilityRole="menu"
          >
            {rows.map(renderRow)}
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
          accessibilityLabel={t("attach.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        <View
          style={[styles.sheet, { paddingBottom: (insets?.bottom ?? 0) + th.space["3"] }]}
          accessibilityRole="menu"
        >
          {rows.map(renderRow)}
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
  card: {
    minWidth: CARD_WIDTH,
    maxWidth: 320,
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  rowPressed: {
    backgroundColor: t.colors.surfaceTint,
    opacity: 0.85,
  },
  rowLabel: {
    flex: 1,
  },
}))
