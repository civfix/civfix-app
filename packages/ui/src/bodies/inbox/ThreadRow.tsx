import React, { useCallback, useMemo, useState } from "react"
import {
  View,
  Pressable,
  Animated,
  StyleSheet,
  type AccessibilityActionEvent,
  type PressableStateCallbackType,
} from "react-native"
import type { MessageThreadDTO } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  hitSlopToTarget,
  space,
  wash,
  useTheme,
  webHover,
  webTransition,
  WEB_ROW_FOCUS_INSET,
} from "../../theme"
import { Text, Icon, iconMap, type IconName } from "../../typography"
import { ThreadAvatar, PopoverMenu, usePopoverAnchor, useSwipeActions, closeOpenSwipeActions } from "../../primitives"
import type { PopoverMenuItem, AnchorRect } from "../../primitives"
import type { ThreadRoomVars } from "../../data"
import { useT } from "../../i18n"
import { threadRowActions, unreadBadgeLabel, type ThreadRowActionKey } from "../messagesListModel"
import { useRowHover } from "../rowHover"
import { useTickingListTimeAgo } from "../useListTimeAgo"
import { IS_WEB, ROW_AVATAR, ROW_GAP, ROW_GUTTER } from "./inboxLayout"
import { threadRoomId } from "../../data/threadRoom"

type TFn = ReturnType<typeof useT>["t"]

const ROW_PADDING_V = space["3"] + 2
const ROW_MIN_HEIGHT = 80
const ROW_MENU_CHIP = 28
const ROW_MENU_GLYPH = 16
const ROW_MENU_SLOT = ROW_MENU_CHIP + space["2"]
const ROW_MENU_HIT_SLOP = hitSlopToTarget(ROW_MENU_CHIP)
const SWIPE_ACTION_GLYPH = 18

/**
 * The row "More" chip is always mounted on web, because hover alone left keyboard, screen-reader and
 * touch-browser users with no path to mute, mark read or delete (rn-web ignores accessibilityActions).
 * It stays visible on a coarse pointer, where there is no hover to reveal it.
 */
function rowMenuChipShown(
  state: PressableStateCallbackType,
  hoveredOrOpen: boolean,
  coarsePointer: boolean,
): boolean {
  if (hoveredOrOpen || coarsePointer) return true
  return (state as PressableStateCallbackType & { focused?: boolean }).focused === true
}

function previewText(thread: MessageThreadDTO, t: TFn): string {
  const body = thread.last?.trim()
  if (!body) return t("preview.new_conversation")
  return thread.lastFromMe ? t("preview.from_me", { text: body }) : body
}

function ThreadRowAction({
  icon,
  label,
  a11yLabel,
  tone,
  onPress,
}: {
  icon: IconName
  label: string
  a11yLabel?: string
  tone: "mute" | "read" | "delete"
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.swipeAction,
        tone === "read"
          ? styles.swipeActionRead
          : tone === "delete"
            ? styles.swipeActionDelete
            : styles.swipeActionMute,
        pressed ? styles.swipeActionPressed : null,
      ]}
    >
      <Icon icon={iconMap[icon]} size={SWIPE_ACTION_GLYPH} color={th.colors.neutral.card} />
      <Text style={styles.swipeActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export const ThreadRow = React.memo(function ThreadRow({
  thread,
  onPress,
  onToggleMute,
  onMarkRead: markRead,
  onHide,
  coarsePointer,
}: {
  thread: MessageThreadDTO
  onPress: (t: MessageThreadDTO) => void
  onToggleMute: (vars: ThreadRoomVars & { muted: boolean }) => void
  onMarkRead: (vars: ThreadRoomVars) => void
  onHide: (vars: ThreadRoomVars & { hidden: boolean }) => void
  coarsePointer: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("messages-list")
  const timeAgo = useTickingListTimeAgo()
  const { hovered, hoverProps } = useRowHover()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuEverOpened, setMenuEverOpened] = useState(false)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const { ref: menuRef, measure } = usePopoverAnchor(setAnchorRect)

  const isGroup = thread.kind === "group" || thread.kind === "cleanup" || thread.kind === "report"
  const isChannel = thread.channel === true
  const unread = thread.unread > 0
  const muted = thread.muted === true
  const roomId = threadRoomId(thread)
  const roomKind = thread.kind

  const muteLabel = muted ? t("row.action.unmute") : t("row.action.mute")
  const markReadLabel = t("row.action.mark_read")
  const deleteLabel = t("row.action.delete")
  const deleteA11yLabel = t("row.action.delete_a11y")
  const rowActions = useMemo(
    () =>
      threadRowActions({
        unread,
        muted,
        labels: { mute: muteLabel, markRead: markReadLabel, delete: deleteLabel, deleteA11y: deleteA11yLabel },
      }),
    [unread, muted, muteLabel, markReadLabel, deleteLabel, deleteA11yLabel],
  )

  const swipe = useSwipeActions({ enabled: !IS_WEB, actionCount: rowActions.length })
  const closeActions = swipe.close

  const onMute = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    onToggleMute({ roomKind, roomId, muted: !muted })
  }, [closeActions, onToggleMute, roomKind, roomId, muted])

  const onMarkRead = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    if (!unread) return
    markRead({ roomKind, roomId })
  }, [closeActions, markRead, unread, roomKind, roomId])

  const onDelete = useCallback(() => {
    closeActions()
    setMenuOpen(false)
    onHide({ roomKind, roomId, hidden: true })
  }, [closeActions, onHide, roomKind, roomId])

  const actionHandlers = useMemo<Record<ThreadRowActionKey, () => void>>(
    () => ({ mute: onMute, markRead: onMarkRead, delete: onDelete }),
    [onMute, onMarkRead, onDelete],
  )

  const a11yActions = useMemo(
    () => rowActions.map((action) => ({ name: action.key, label: action.a11yLabel })),
    [rowActions],
  )
  const onA11yAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "markRead") onMarkRead()
      else if (event.nativeEvent.actionName === "mute") onMute()
      else if (event.nativeEvent.actionName === "delete") onDelete()
    },
    [onMarkRead, onMute, onDelete],
  )

  const menuItems = useMemo<PopoverMenuItem[]>(
    () =>
      rowActions.map((action) => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        ...(action.destructive ? { destructive: true } : {}),
        onPress: actionHandlers[action.key],
      })),
    [rowActions, actionHandlers],
  )

  const stamp = thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : thread.ago

  const rowContent = (
    <Pressable
      onPress={() => {
        if (swipe.open) {
          closeActions()
          return
        }
        if (closeOpenSwipeActions()) return
        onPress(thread)
      }}
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? t("row.a11y_unread", { title: thread.title, count: thread.unread })
          : thread.title
      }
      accessibilityActions={a11yActions}
      onAccessibilityAction={onA11yAction}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        WEB_ROW_FOCUS_INSET,
        webTransition,
        hovered ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <ThreadAvatar thread={thread} size={ROW_AVATAR} />
      <View style={styles.meta}>
        <View style={styles.topRow}>
          {isChannel ? (
            <View accessible accessibilityLabel={t("row.a11y_channel")}>
              <Icon icon={iconMap.Megaphone} size={13} color={th.colors.textMuted} />
            </View>
          ) : null}
          <Text style={[styles.title, unread ? styles.titleUnread : null]} numberOfLines={1}>
            {thread.title}
          </Text>
          {muted ? (
            <View accessible accessibilityLabel={t("row.a11y_muted")}>
              <Icon icon={iconMap.BellOff} size={13} color={th.colors.textSubtle} />
            </View>
          ) : null}
          {stamp ? <Text style={styles.ago}>{stamp}</Text> : null}
        </View>
        <View style={styles.lastRow}>
          <Text style={[styles.last, unread ? styles.lastUnread : null]} numberOfLines={1}>
            {previewText(thread, t)}
          </Text>
          {unread ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{unreadBadgeLabel(thread.unread)}</Text>
            </View>
          ) : null}
        </View>
        {isGroup && thread.members > 0 ? (
          <Text style={styles.sub}>
            {isChannel
              ? t("row.subscribers", { count: thread.members })
              : t("row.members", { count: thread.members })}
          </Text>
        ) : null}
      </View>
      {IS_WEB ? <View style={styles.menuSlot} /> : null}
    </Pressable>
  )

  return (
    <View {...hoverProps} style={styles.rowWrap}>
      {swipe.active ? (
        <>
          <Animated.View
            pointerEvents={swipe.open ? "auto" : "none"}
            style={[styles.actionsLayer, { width: swipe.width, opacity: swipe.progress }]}
          >
            {rowActions.map((action) => (
              <ThreadRowAction
                key={action.key}
                icon={action.icon}
                label={action.label}
                a11yLabel={action.a11yLabel}
                tone={action.tone}
                onPress={actionHandlers[action.key]}
              />
            ))}
          </Animated.View>
          <Animated.View
            style={[styles.rowShift, { transform: [{ translateX: swipe.translateX }] }]}
            {...swipe.panHandlers}
          >
            {rowContent}
          </Animated.View>
        </>
      ) : (
        rowContent
      )}
      {IS_WEB ? (
        <View style={styles.menuHost}>
          <Pressable
            ref={menuRef}
            onPress={() => {
              measure()
              setMenuEverOpened(true)
              setMenuOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t("row.action.more")}
            hitSlop={ROW_MENU_HIT_SLOP}
            {...focusRingProps}
            style={(state) => [
              styles.menuChip,
              webTransition,
              rowMenuChipShown(state, hovered || menuOpen, coarsePointer) ? null : styles.menuChipConcealed,
              webHover(state) ? styles.menuChipHovered : null,
              state.pressed ? styles.menuChipPressed : null,
            ]}
          >
            <Icon icon={iconMap.Ellipsis} size={ROW_MENU_GLYPH} color={th.colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {menuEverOpened ? (
        <PopoverMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRect={anchorRect}
          items={menuItems}
        />
      ) : null}
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  rowWrap: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: t.colors.bg,
  },
  rowShift: {
    backgroundColor: t.colors.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: ROW_PADDING_V,
    paddingHorizontal: ROW_GUTTER,
    backgroundColor: t.colors.bg,
  },
  rowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowPressed: {
    backgroundColor: wash(t.colors.borderStrong, 0.35, t),
  },
  actionsLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: "row",
  },
  swipeAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
    paddingHorizontal: t.space["1"],
  },
  swipeActionMute: {
    backgroundColor: t.colors.textMuted,
  },
  swipeActionRead: {
    backgroundColor: t.colors.accent,
  },
  swipeActionDelete: {
    backgroundColor: t.colors.bloom["600"],
  },
  swipeActionPressed: {
    opacity: 0.85,
  },
  swipeActionLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: t.colors.neutral.card,
  },
  menuSlot: {
    width: ROW_MENU_SLOT,
    flexShrink: 0,
  },
  menuHost: {
    position: "absolute",
    right: ROW_GUTTER,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  menuChip: {
    width: ROW_MENU_CHIP,
    height: ROW_MENU_CHIP,
    borderRadius: ROW_MENU_CHIP / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  menuChipConcealed: {
    opacity: 0,
  },
  menuChipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  menuChipPressed: {
    backgroundColor: t.colors.border,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  titleUnread: {
    fontFamily: t.fontFamily.bodyBold,
  },
  ago: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  lastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: 2,
  },
  last: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.textSubtle,
  },
  lastUnread: {
    fontFamily: t.fontFamily.bodySemiBold,
    color: t.colors.text,
  },
  unread: {
    flexShrink: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  unreadText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    color: t.colors.onAccent,
  },
  sub: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.textSubtle,
    marginTop: 3,
  },
}))
