import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { ErrorCode, errorCopyKey, type ErrorCodeTable, type NotificationDTO, type NotificationType } from "@civfix/contract"
import { focusRingProps, makeThemedStyles, useLayoutMode, useTheme, webHover, webTransition, type Theme } from "../theme"
import { Text, Icon, iconMap, type IconName } from "../typography"
import { EmptyState, LoadingState, SignInPrompt, useToast } from "../primitives"
import {
  useNotifications,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
  useHasUnreadNotifications,
  useAuthState,
  useRequireAuth,
} from "../data"
import { useNavStore, entryFromPath, isRootLink } from "../nav"
import { useOpenInternalHref } from "../capabilities"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { idKeyExtractor } from "../primitives/listKeys"
import { useListTimeAgo } from "./useListTimeAgo"

const MARK_READ_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.RATE_LIMITED]: "markReadError.rate_limited",
}

function typeMeta(type: NotificationType, t: Theme): { glyph: IconName; color: string; tint: string } {
  switch (type) {
    case "report_update":
      return { glyph: "MapPin", color: t.colors.brand.sky, tint: t.colors.sky["50"] }
    case "cleanup_chat":
      return { glyph: "MessageCircle", color: t.colors.brand.moss, tint: t.colors.moss["50"] }
    case "report_chat":
      return { glyph: "MessageCircle", color: t.colors.brand.sky, tint: t.colors.sky["50"] }
    case "cleanup_reminder":
      return { glyph: "Calendar", color: t.colors.brand.sun, tint: t.colors.sun["50"] }
    case "cleanup_role":
      return { glyph: "Megaphone", color: t.colors.brand.moss, tint: t.colors.moss["50"] }
    case "new_follower":
      return { glyph: "UserPlus", color: t.colors.brand.lilac, tint: t.colors.lilac["50"] }
    case "claim_available":
      return { glyph: "Award", color: t.colors.brand.bloom, tint: t.colors.bloom["50"] }
    case "hours_logged":
      return { glyph: "Award", color: t.colors.brand.bloom, tint: t.colors.bloom["50"] }
    case "event_team_invite":
      return { glyph: "ClipboardList", color: t.colors.brand.sun, tint: t.colors.sun["50"] }
    case "cleanup_slot":
      return {
        glyph: "ClipboardList",
        color: t.colors.brand.moss,
        tint: t.colors.moss["50"],
      }
    case "chat_mention":
      return { glyph: "AtSign", color: t.colors.brand.lilac, tint: t.colors.lilac["50"] }
    case "system":
    default:
      return { glyph: "Bell", color: t.colors.textMuted, tint: t.colors.neutral.paper2 }
  }
}

const NotificationRow = memo(function NotificationRow({
  item,
  unread,
  timeAgo,
  onPress,
}: {
  item: NotificationDTO
  unread: boolean
  timeAgo: (iso: string) => string
  onPress: (item: NotificationDTO) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("notifications")
  const meta = typeMeta(item.type, th)
  const press = useCallback(() => onPress(item), [onPress, item])
  const a11yDetails = [item.body, timeAgo(item.createdAt)].filter(Boolean)
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={unread
        ? [t("row.unreadSuffix", { title: item.title }), ...a11yDetails].join(", ")
        : [item.title, ...a11yDetails].join(", ")}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        unread ? styles.rowUnread : null,
        webHover(state) ? (unread ? styles.rowUnreadHovered : styles.rowHovered) : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: meta.tint }]}>
        <Icon icon={iconMap[meta.glyph]} size={20} color={meta.color} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleRow}>
          {unread ? <View style={styles.unreadDot} /> : null}
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        {item.body ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
    </Pressable>
  )
})

export function NotificationsBody() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("notifications")
  const { t: tNav } = useT("nav")
  const { FlatList } = useScrollHost()
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const query = useNotifications()
  const markRead = useMarkNotificationsRead()
  const markAllRead = useMarkAllNotificationsRead()
  const hasUnread = useHasUnreadNotifications()
  const toast = useToast()
  const notifications = query.data ?? NO_NOTIFICATIONS
  const timeAgo = useListTimeAgo()

  const showPrefsGear = useLayoutMode() === "expanded"
  const openPrefs = useCallback(() => {
    useNavStore.getState().push({ kind: "notification-prefs" })
  }, [])

  // Viewing marks everything read, yet a row keeps its unread look for the rest of the visit, so the reader
  // still sees what was new when the page opened.
  const [shownUnread, setShownUnread] = useState<ReadonlySet<string>>(NO_IDS)
  useEffect(() => {
    const fresh = notifications.filter((n) => !n.read && !shownUnread.has(n.id)).map((n) => n.id)
    if (fresh.length > 0) setShownUnread((prev) => new Set([...prev, ...fresh]))
  }, [notifications, shownUnread])

  // Marking waits for a settled list, so a row that arrives with the refetch is seen unread before it is
  // marked. A failure is not retried this visit: the rollback brings hasUnread back, which would loop.
  const listShown = query.data !== undefined && !query.isFetching
  const mutateMarkAll = markAllRead.mutate
  const markAllBlocked = markAllRead.isPending || markAllRead.isError
  useEffect(() => {
    if (!listShown || !hasUnread || markAllBlocked) return
    mutateMarkAll(undefined, {
      onError: (err) =>
        toast.show(t(errorCopyKey(err, MARK_READ_ERROR_KEYS, "markReadError.generic")), { variant: "error" }),
    })
  }, [listShown, hasUnread, markAllBlocked, mutateMarkAll, toast, t])

  const mutateRead = markRead.mutate

  const entryForHref = useOpenInternalHref()?.entryFor ?? entryFromPath
  const onPressItem = useCallback(
    (item: NotificationDTO) => {
      if (!item.read) mutateRead([item.id])
      const entry = entryForHref(item.link)
      if (entry) useNavStore.getState().push(entry)
      else if (isRootLink(item.link)) useNavStore.getState().selectView("home")
    },
    [entryForHref, mutateRead],
  )

  const renderItem = useCallback(
    ({ item }: { item: NotificationDTO }) => (
      <NotificationRow
        item={item}
        unread={!item.read || shownUnread.has(item.id)}
        timeAgo={timeAgo}
        onPress={onPressItem}
      />
    ),
    [timeAgo, onPressItem, shownUnread],
  )

  const emptyContent = useMemo(() => {
    if (!isAuthenticated && !isPending) {
      return (
        <View style={styles.emptyFill}>
          <SignInPrompt
            icon={iconMap.Bell}
            iconSize={32}
            variant="detail"
            title={t("signedOut.title")}
            body={t("signedOut.body")}
            onSignIn={() => requireAuth(() => {}, { next: "/notifications" })}
          />
        </View>
      )
    }
    if (isPending || query.isLoading) {
      return <LoadingState skeleton="notification" rows={8} />
    }
    if (query.isError) {
      return (
        <View style={styles.emptyFill}>
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        </View>
      )
    }
    return (
      <View style={styles.emptyFill}>
        <EmptyState
          variant="detail"
          tone="moss"
          icon={iconMap.BellOff}
          title={t("empty.title")}
          body={t("empty.body")}
        />
      </View>
    )
  }, [isAuthenticated, isPending, query.isLoading, query.isError, requireAuth, t, styles, th])

  return (
    <FlatList
      data={notifications}
      keyExtractor={idKeyExtractor}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        showPrefsGear ? (
          <View style={styles.head}>
            <Pressable
              onPress={openPrefs}
              accessibilityRole="button"
              accessibilityLabel={tNav("title.notification_prefs")}
              hitSlop={8}
              {...focusRingProps}
              style={({ pressed }) => [styles.prefsGear, pressed ? styles.pressed : null]}
            >
              <Icon icon={iconMap.Settings} size={16} color={th.colors.textMuted} />
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={emptyContent}
      renderItem={renderItem}
    />
  )
}

const NO_NOTIFICATIONS: readonly NotificationDTO[] = []
const NO_IDS: ReadonlySet<string> = new Set()

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["10"],
    flexGrow: 1,
  },
  emptyFill: {
    flexGrow: 1,
    paddingTop: t.space["8"],
    justifyContent: "center",
  },

  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  prefsGear: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"] - 2,
    paddingHorizontal: t.space["1"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  rowUnread: {
    backgroundColor: t.colors.bloom["50"],
    borderRadius: t.radius.md,
    borderBottomColor: "transparent",
  },
  rowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderRadius: t.radius.md,
    borderBottomColor: "transparent",
  },
  rowUnreadHovered: {
    backgroundColor: t.colors.bloom["100"],
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowTitle: {
    flex: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 17,
    color: t.colors.text,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 11.5,
    lineHeight: 15,
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  rowTime: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: t.colors.brand.bloom,
    flexShrink: 0,
  },
  pressed: { opacity: 0.6 },
}))
