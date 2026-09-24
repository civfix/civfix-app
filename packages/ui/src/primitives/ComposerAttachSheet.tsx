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
  focusRingProps,
  webScrimProps,
} from "../theme"
import { iconMap } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import type { AnchorRect } from "./PopoverMenu"
import { composerAttachRows, type ComposerAttachRowKey } from "./composerAttachRows"
import { MenuItemContent } from "./MenuItemContent"
import { menuRowStyles, menuSurfaceStyle } from "./menuSurface"
import { resolveBandLeft } from "./messageContextMenuLayout"

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

  const handlers: Record<ComposerAttachRowKey, () => void> = { photo: onPhoto, camera: onCamera, poll: onPoll }

  const pendingActionRef = React.useRef<(() => void) | null>(null)
  const choose = (key: ComposerAttachRowKey) => {
    const action = handlers[key]
    if (Platform.OS === "ios") {
      pendingActionRef.current = action
      onClose()
      return
    }
    onClose()
    action()
  }
  const onModalDismiss = () => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) action()
  }

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
        <MenuItemContent
          icon={iconMap[ROW_ICON[key]]}
          iconSize={18}
          color={th.colors.text}
          label={label}
          labelStyle={styles.rowLabel}
        />
      </Pressable>
    )
  }

  if (isWeb) {
    let cardPosition: { bottom: number; left: number } | null = null
    if (anchor) {
      cardPosition = {
        bottom: Math.max(EDGE_MARGIN, winH - anchor.y + GAP),
        left: resolveBandLeft(anchor, winW, CARD_WIDTH, false, { edgeMargin: EDGE_MARGIN }),
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
    ...menuSurfaceStyle(t),
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
  ...menuRowStyles(t, t.space["3"]),
}))
