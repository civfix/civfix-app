import React from "react"
import { Pressable, Platform } from "react-native"
import { makeThemedStyles, useTheme, webCursorPointer, webTransition, webHover, focusRingProps } from "../theme"
import { iconMap } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import type { AnchorRect } from "./PopoverMenu"
import { AnchoredActionSheet } from "./AnchoredActionSheet"
import { composerAttachRows, type ComposerAttachRowKey } from "./composerAttachRows"
import { MenuItemContent } from "./MenuItemContent"
import { menuRowStyles } from "./menuSurface"

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
const CARD_MAX_WIDTH = 320
const ROW_ICON_SIZE = 18

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

  const rows = composerAttachRows({ isWeb: Platform.OS === "web", canCreatePoll })

  const handlers: Record<ComposerAttachRowKey, () => void> = { photo: onPhoto, camera: onCamera, poll: onPoll }

  return (
    <AnchoredActionSheet
      visible={visible}
      onClose={onClose}
      anchor={anchor}
      cardWidth={CARD_WIDTH}
      cardMaxWidth={CARD_MAX_WIDTH}
      dismissLabel={t("attach.dismiss")}
    >
      {(runAfterDismiss) =>
        rows.map((key) => {
          const label = t(`attach.${key}`)
          return (
            <Pressable
              key={key}
              onPress={() => runAfterDismiss(handlers[key])}
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
                iconSize={ROW_ICON_SIZE}
                color={th.colors.text}
                label={label}
                labelStyle={styles.rowLabel}
              />
            </Pressable>
          )
        })
      }
    </AnchoredActionSheet>
  )
}

const useStyles = makeThemedStyles((t) => menuRowStyles(t, t.space["3"]))
