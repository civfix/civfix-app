import React, { useEffect, useRef } from "react"
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native"
import { REACTION_EMOJIS, type ReactionEmoji } from "@civfix/shared"
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
import { Text } from "../typography"
import type { LucideIcon } from "../typography"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import { REACTION_GLYPH } from "./reactionChipModel"
import { menuCardStyle, menuOrigin, menuScrimStyle, useMenuMotion } from "./menuMotion"
import type { AnchorRect } from "./PopoverMenu"
import { useDeferredOverlayAction } from "./useDeferredOverlayAction"
import { useModalClosed } from "./useModalClosed"
import { MenuItemContent } from "./MenuItemContent"
import { menuRowStyles, menuSurfaceStyle } from "./menuSurface"
import {
  resolveMenuPlacement,
  resolveBandLeft,
  resolveWebMenuFrame,
  CONTEXT_MENU_GAP,
  CONTEXT_MENU_EDGE_MARGIN,
} from "./messageContextMenuLayout"

export type ContextMenuActionKey =
  | "reply"
  | "copy"
  | "edit"
  | "pin"
  | "unpin"
  | "jump"
  | "delete"
  | "report"
  | "block"
  | "retractVote"
  | "stopPoll"

export interface ContextMenuAction {
  key: ContextMenuActionKey
  label: string
  icon: LucideIcon
  destructive?: boolean
  onPress: () => void
}

export interface MessageContextMenuProps {
  visible: boolean
  onClose: () => void
  onClosed?: () => void
  anchor: AnchorRect | null
  bubble: React.ReactNode
  mine: boolean
  reactions: { emoji: ReactionEmoji; mine: boolean }[]
  onReact: (emoji: ReactionEmoji) => void
  actions: ContextMenuAction[]
  showReactions?: boolean
}

const CARD_WIDTH = 240
const WEB_CARD_WIDTH = 264
const ACTION_ROW_H = 38
const CARD_PAD_V = space["1"] * 2
const REACTION_ROW_H = 48
const GLYPH_BUTTON = 36
const GLYPH_GAP = space["1"]
const BUBBLE_POP_FROM = 0.96
const BUBBLE_SPRING = { friction: 7, tension: 120 } as const

export function MessageContextMenu({
  visible,
  onClose,
  onClosed,
  anchor,
  bubble,
  mine,
  reactions,
  onReact,
  actions,
  showReactions = true,
}: MessageContextMenuProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { t: tReactions } = useT("conversation-reactions")
  const { width: winW, height: winH } = useWindowDimensions()
  const haptics = useHaptics()
  const isWeb = Platform.OS === "web"
  const motion = useMenuMotion({ visible })
  const rendered = motion.rendered
  const { run, settled } = useDeferredOverlayAction(visible, onClose, onClosed)
  const onModalDismiss = useModalClosed(rendered, settled)

  const scale = useRef(new Animated.Value(BUBBLE_POP_FROM)).current
  useEffect(() => {
    if (!rendered) {
      scale.setValue(BUBBLE_POP_FROM)
      return
    }
    if (isWeb) return
    haptics.impactLight()
    if (motion.reducedMotion) {
      scale.setValue(1)
      return
    }
    const springIn = Animated.spring(scale, {
      toValue: 1,
      ...BUBBLE_SPRING,
      useNativeDriver: motion.useNativeDriver,
    })
    springIn.start()
    return () => springIn.stop()
  }, [rendered, isWeb, haptics, scale, motion.reducedMotion, motion.useNativeDriver])

  const mineSet = new Set(reactions.filter((r) => r.mine).map((r) => r.emoji))

  const handleReact = (emoji: ReactionEmoji) => run(() => onReact(emoji))
  const handleAction = (action: ContextMenuAction) => run(action.onPress)

  const renderActionRow = (action: ContextMenuAction) => {
    const color = action.destructive ? th.colors.bloom["600"] : th.colors.text
    return (
      <Pressable
        key={action.key}
        onPress={() => handleAction(action)}
        accessibilityRole="menuitem"
        accessibilityLabel={action.label}
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
          icon={action.icon}
          iconSize={16}
          color={color}
          label={action.label}
          labelStyle={styles.rowLabel}
        />
      </Pressable>
    )
  }

  const renderGlyph = (emoji: ReactionEmoji, compact: boolean) => {
    const selected = mineSet.has(emoji)
    return (
      <Pressable
        key={emoji}
        onPress={() => handleReact(emoji)}
        accessibilityRole="button"
        accessibilityLabel={tReactions(`label.${emoji}`)}
        accessibilityState={{ selected }}
        hitSlop={compact ? { top: 8, bottom: 8 } : { top: 4, bottom: 4 }}
        {...focusRingProps}
        style={(state) => [
          compact ? styles.glyphButtonCompact : styles.glyphButton,
          selected ? styles.glyphButtonSelected : null,
          webTransition,
          webCursorPointer,
          webHover(state) ? styles.glyphHovered : null,
          state.pressed ? styles.glyphPressed : null,
        ]}
      >
        <Text style={[compact ? styles.glyphCompact : styles.glyph, webNoSelect]}>
          {REACTION_GLYPH[emoji]}
        </Text>
      </Pressable>
    )
  }

  if (isWeb) {
    const { actionsMaxH, cardH, position: cardPosition } = resolveWebMenuFrame(
      anchor,
      { width: winW, height: winH },
      {
        actionCount: actions.length,
        actionRowH: ACTION_ROW_H,
        reactionRowH: showReactions ? REACTION_ROW_H : 0,
        cardPadV: CARD_PAD_V,
        cardWidth: WEB_CARD_WIDTH,
      },
      mine,
    )
    const webOrigin = menuOrigin(
      anchor,
      cardPosition ? { ...cardPosition, width: WEB_CARD_WIDTH, height: cardH } : null,
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
          style={cardPosition ? styles.rootAnchored : styles.rootCentered}
          pointerEvents={motion.exiting ? "none" : "auto"}
        >
          <Pressable
            style={styles.backdropWeb}
            accessibilityRole="button"
            accessibilityLabel={t("context_menu.dismiss")}
            onPress={onClose}
            {...webScrimProps}
          />
          <Animated.View
            style={[
              styles.card,
              styles.cardWeb,
              cardPosition ? { position: "absolute", ...cardPosition } : null,
              menuCardStyle(motion, webOrigin),
            ]}
            accessibilityRole="menu"
          >
            {showReactions ? (
              <>
                <View
                  style={styles.webReactionRow}
                  accessibilityRole="toolbar"
                  accessibilityLabel={t("context_menu.reactions")}
                >
                  {REACTION_EMOJIS.map((emoji) => renderGlyph(emoji, true))}
                </View>
                <View style={styles.separator} />
              </>
            ) : null}
            <ScrollView style={{ maxHeight: actionsMaxH }}>{actions.map(renderActionRow)}</ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const nativeReactionRowH = showReactions ? REACTION_ROW_H : 0
  const actionsMaxH = Math.max(
    ACTION_ROW_H * 2,
    winH - CONTEXT_MENU_EDGE_MARGIN * 2 - nativeReactionRowH - CONTEXT_MENU_GAP * 2 - CARD_PAD_V,
  )
  const menuH = Math.min(actions.length * ACTION_ROW_H, actionsMaxH) + CARD_PAD_V
  let bands: { bubbleTop: number; reactionsTop: number; menuTop: number } | null = null
  let bubbleLeft = 0
  let reactionsLeft = 0
  let cardLeft = 0
  const reactionRowW = Math.min(
    REACTION_EMOJIS.length * GLYPH_BUTTON +
      (REACTION_EMOJIS.length - 1) * GLYPH_GAP +
      space["2"] * 2,
    winW - CONTEXT_MENU_EDGE_MARGIN * 2,
  )
  if (anchor) {
    bands = resolveMenuPlacement(anchor, winH, menuH, nativeReactionRowH)
    bubbleLeft = anchor.x
    reactionsLeft = resolveBandLeft(anchor, winW, reactionRowW, mine)
    cardLeft = resolveBandLeft(anchor, winW, CARD_WIDTH, mine)
  }

  const renderReactionRow = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.reactionScrollContent}
    >
      {REACTION_EMOJIS.map((emoji) => renderGlyph(emoji, false))}
    </ScrollView>
  )

  const cardOrigin = menuOrigin(
    anchor,
    bands ? { left: cardLeft, top: bands.menuTop, width: CARD_WIDTH, height: menuH } : null,
  )
  const reactionOrigin = menuOrigin(
    anchor,
    bands
      ? { left: reactionsLeft, top: bands.reactionsTop, width: reactionRowW, height: REACTION_ROW_H }
      : null,
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
        style={bands ? styles.rootAnchored : styles.rootCentered}
        pointerEvents={motion.exiting ? "none" : "auto"}
      >
        <Animated.View pointerEvents="none" style={[styles.scrim, menuScrimStyle(motion)]} />
        <Pressable
          style={styles.scrimTouch}
          accessibilityRole="button"
          accessibilityLabel={t("context_menu.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        {bands ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bubbleHolder,
                {
                  top: bands.bubbleTop,
                  left: bubbleLeft,
                  width: anchor ? anchor.width : undefined,
                  opacity: motion.progress,
                  transform: [{ scale }],
                },
              ]}
            >
              {bubble}
            </Animated.View>
            {showReactions ? (
              <Animated.View
                style={[
                  styles.reactionCard,
                  { top: bands.reactionsTop, left: reactionsLeft, width: reactionRowW },
                  menuCardStyle(motion, reactionOrigin),
                ]}
                accessibilityRole="toolbar"
                accessibilityLabel={t("context_menu.reactions")}
              >
                {renderReactionRow()}
              </Animated.View>
            ) : null}
            <Animated.View
              style={[
                styles.card,
                { position: "absolute", top: bands.menuTop, left: cardLeft },
                menuCardStyle(motion, cardOrigin),
              ]}
              accessibilityRole="menu"
            >
              <ScrollView style={{ maxHeight: actionsMaxH }}>{actions.map(renderActionRow)}</ScrollView>
            </Animated.View>
          </>
        ) : (
          <Animated.View style={[styles.centeredColumn, menuCardStyle(motion, cardOrigin)]}>
            {showReactions ? (
              <View style={[styles.reactionCard, styles.reactionCardCentered]}>{renderReactionRow()}</View>
            ) : null}
            <View style={[styles.card, styles.cardCentered]} accessibilityRole="menu">
              <ScrollView style={{ maxHeight: actionsMaxH }}>{actions.map(renderActionRow)}</ScrollView>
            </View>
          </Animated.View>
        )}
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
  centeredColumn: {
    alignItems: "center",
    gap: t.space["2"],
    width: "100%",
    maxWidth: 320,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  scrimTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropWeb: {
    ...StyleSheet.absoluteFillObject,
  },
  bubbleHolder: {
    position: "absolute",
  },
  reactionCard: {
    position: "absolute",
    height: REACTION_ROW_H,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  reactionCardCentered: {
    position: "relative",
  },
  reactionScrollContent: {
    alignItems: "center",
    gap: GLYPH_GAP,
    paddingHorizontal: t.space["2"],
    height: REACTION_ROW_H,
  },
  glyphButton: {
    width: GLYPH_BUTTON,
    height: GLYPH_BUTTON,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphButtonCompact: {
    width: 28,
    height: 28,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphButtonSelected: {
    backgroundColor: t.colors.bloom["50"],
    borderWidth: 1,
    borderColor: t.colors.bloom["700"],
  },
  glyph: {
    fontSize: 22,
    lineHeight: 28,
  },
  glyphCompact: {
    fontSize: t.fontSize["16"],
    lineHeight: 20,
  },
  glyphHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  glyphPressed: {
    opacity: 0.6,
  },
  card: {
    width: CARD_WIDTH,
    ...menuSurfaceStyle(t),
  },
  cardCentered: {
    width: "100%",
    maxWidth: 320,
  },
  cardWeb: {
    width: WEB_CARD_WIDTH,
  },
  webReactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.space["1"],
    paddingVertical: t.space["1"],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
    marginVertical: t.space["1"],
    marginHorizontal: t.space["1"],
  },
  ...menuRowStyles(t, t.space["2"]),
}))
