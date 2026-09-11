import React, { useCallback, useEffect, useRef } from "react"
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type View as RNView,
} from "react-native"
import {
  makeThemedStyles,
  space,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  focusRingProps,
  webNoSelect,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import { positionPostActionMenu } from "./postActionModel"
import { menuOrigin, useMenuMotion } from "./menuMotion"
import { AnchoredPopover, useMenuCardSize } from "./AnchoredPopover"

export interface PopoverMenuItem {
  key: string
  label: string
  accessibilityLabel?: string
  icon?: IconName
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PopoverMenuProps {
  visible: boolean
  onClose: () => void
  anchorRect?: AnchorRect | null
  items: PopoverMenuItem[]
  align?: "left" | "right"
  onDismiss?: () => void
}

const CARD_WIDTH = 220
const ROW_HEIGHT = space["2"] * 2 + 20
const CARD_PAD_V = space["1"] * 2

export function PopoverMenu({
  visible,
  onClose,
  anchorRect,
  items,
  align = "right",
  onDismiss,
}: PopoverMenuProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common")
  const { width: winW, height: winH } = useWindowDimensions()
  const { size: cardSize, onLayout: onCardLayout, reset: resetCardSize } = useMenuCardSize()
  const itemCount = items.length
  const anchored = anchorRect != null
  const measuring = anchored && cardSize === null
  const motion = useMenuMotion({ visible, ready: !measuring })
  const rendered = motion.rendered
  useEffect(() => {
    resetCardSize()
  }, [itemCount, rendered, resetCardSize])

  const viewportKey = `${winW}x${winH}`
  const openedAtRef = useRef(viewportKey)
  useEffect(() => {
    if (!visible) {
      openedAtRef.current = viewportKey
      return
    }
    if (openedAtRef.current !== viewportKey) onClose()
  }, [visible, viewportKey, onClose])

  const handlePress = useCallback(
    (item: PopoverMenuItem) => {
      onClose()
      item.onPress()
    },
    [onClose],
  )

  const cardSizeOrEstimate = cardSize ?? {
    width: CARD_WIDTH,
    height: itemCount * ROW_HEIGHT + CARD_PAD_V,
  }
  const cardPosition = anchorRect
    ? positionPostActionMenu(anchorRect, { width: winW, height: winH }, cardSizeOrEstimate, align)
    : null

  const origin = menuOrigin(
    anchorRect,
    cardPosition ? { ...cardPosition, ...cardSizeOrEstimate } : null,
  )

  return (
    <AnchoredPopover
      motion={motion}
      origin={origin}
      onClose={onClose}
      onDismiss={onDismiss}
      dismissLabel={t("dismiss_menu")}
      centered={!anchored}
      onCardLayout={anchored ? onCardLayout : undefined}
      cardStyle={[
        styles.card,
        anchored ? { position: "absolute", ...cardPosition } : styles.cardCentered,
      ]}
      accessibilityRole="menu"
    >
      {items.map((item) => {
        const color = item.destructive ? th.colors.bloom["600"] : th.colors.text
        return (
          <Pressable
            key={item.key}
            onPress={() => handlePress(item)}
            disabled={item.disabled}
            accessibilityRole="menuitem"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ disabled: !!item.disabled }}
            {...focusRingProps}
            style={(state) => [
              styles.row,
              webTransition,
              webCursor(item.disabled),
              webHover(state) && !item.disabled ? styles.rowHovered : null,
              state.pressed && !item.disabled ? styles.rowPressed : null,
              item.disabled ? styles.rowDisabled : null,
            ]}
          >
            {item.icon ? <Icon icon={iconMap[item.icon]} size={16} color={color} /> : null}
            <Text
              variant="body"
              color={color}
              numberOfLines={1}
              style={[styles.rowLabel, webNoSelect]}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </AnchoredPopover>
  )
}

export function usePopoverAnchor(onMeasured: (rect: AnchorRect) => void): {
  ref: React.RefObject<RNView | null>
  measure: () => void
} {
  const ref = useRef<RNView | null>(null)
  const measure = useCallback(() => {
    const node = ref.current
    if (!node || typeof node.measureInWindow !== "function") return
    node.measureInWindow((x, y, width, height) => {
      onMeasured({ x, y, width, height })
    })
  }, [onMeasured])
  return { ref, measure }
}

const useStyles = makeThemedStyles((t) => ({
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
    width: "100%",
    maxWidth: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
  },
  rowHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  rowPressed: {
    backgroundColor: t.colors.surfaceTint,
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowLabel: {
    flex: 1,
  },
}))
