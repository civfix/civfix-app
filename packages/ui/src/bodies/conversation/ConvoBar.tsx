import React from "react"
import { View, Pressable, type View as RNView } from "react-native"
import { focusRingProps, useTheme, type LayoutMode } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { ThreadAvatar, PopoverMenu } from "../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../primitives"
import { useT } from "../../i18n"
import { DETAIL_BACK_ICON_SIZE } from "../../shell/detailHeader"
import type { ConvoMeta } from "./conversationModel"
import { useConversationStyles } from "./styles"

export function ConvoBar({
  meta,
  onlineCount,
  mode,
  onBack,
  onMenu,
  menuOpen,
  menuAnchorRef,
  onMembers,
  onTitlePress,
}: {
  meta: ConvoMeta
  onlineCount: number
  mode: LayoutMode
  onBack: () => void
  onMenu?: () => void
  menuOpen?: boolean
  menuAnchorRef?: React.RefObject<RNView | null>
  onMembers?: () => void
  onTitlePress?: () => void
}) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const isGroup = meta.kind === "group" || meta.kind === "cleanup" || meta.kind === "report"
  const titlePressLabel =
    meta.kind === "group"
      ? t("header.open_group_info")
      : meta.kind === "report" || meta.kind === "cleanup"
        ? t("header.view_members")
        : t("overflow.open_profile_label")
  const isExpanded = mode === "expanded"
  const online = onlineCount > 0
  let sub: string | null
  if (isGroup) {
    if (meta.members > 0) {
      sub = online
        ? t("header.members_with_online", { count: meta.members, online: onlineCount })
        : t("header.members", { count: meta.members })
    } else {
      sub = online ? t("header.crew_chat_with_online", { online: onlineCount }) : t("header.crew_chat")
    }
  } else {
    sub = online ? t("header.online") : null
  }
  const avatarThread = {
    id: meta.roomId,
    kind: meta.kind,
    title: meta.title,
    refId: meta.roomId,
    peer: meta.peerId
      ? { id: meta.peerId, name: meta.peerName ?? meta.title, avatarUrl: meta.peerAvatarUrl ?? null, avatar: meta.peerAvatar ?? null }
      : null,
  }
  return (
    <View style={styles.convoBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("header.back")}
        hitSlop={8}
        {...focusRingProps}
        style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
      >
        <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
      </Pressable>
      {onTitlePress ? (
        <Pressable
          onPress={onTitlePress}
          accessibilityRole="button"
          accessibilityLabel={titlePressLabel}
          hitSlop={6}
          {...focusRingProps}
          style={styles.avatarTap}
        >
          <ThreadAvatar thread={avatarThread} size={38} />
        </Pressable>
      ) : (
        <ThreadAvatar thread={avatarThread} size={38} />
      )}
      <View style={styles.convoTitles}>
        <Text
          style={[styles.convoTitle, isExpanded ? styles.convoTitleExpanded : null]}
          numberOfLines={1}
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? "button" : "header"}
          accessibilityLabel={onTitlePress ? titlePressLabel : undefined}
          {...(onTitlePress ? focusRingProps : null)}
        >
          {meta.title}
        </Text>
        {sub ? (
          isGroup && onMembers ? (
            <Pressable
              onPress={onMembers}
              accessibilityRole="button"
              accessibilityLabel={t("header.view_members")}
              hitSlop={6}
              {...focusRingProps}
              style={({ pressed }) => [styles.convoSubRow, pressed ? styles.convoSubPressed : null]}
            >
              {online ? <View style={styles.onlineDot} /> : null}
              <Text style={styles.convoSub} numberOfLines={1}>
                {sub}
              </Text>
              <Icon icon={iconMap.ChevronRight} size={13} color={th.colors.textSubtle} />
            </Pressable>
          ) : (
            <View style={styles.convoSubRow}>
              {online ? <View style={styles.onlineDot} /> : null}
              <Text style={styles.convoSub} numberOfLines={1}>
                {sub}
              </Text>
            </View>
          )
        ) : null}
      </View>
      {onMenu ? (
        <Pressable
          ref={menuAnchorRef}
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={t("header.more_options")}
          accessibilityState={{ expanded: !!menuOpen }}
          hitSlop={8}
          {...focusRingProps}
          style={({ pressed }) => [styles.menuBtn, pressed || menuOpen ? styles.backPressed : null]}
        >
          <Icon icon={iconMap.Ellipsis} size={20} color={th.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

export function ConvoOverflowMenu({
  visible,
  isReport,
  muted,
  anchorRect,
  onClose,
  onViewReport,
  onToggleMute,
  onLeaveChat,
  onOpenProfile,
  onBlock,
}: {
  visible: boolean
  isReport: boolean
  muted: boolean
  anchorRect: AnchorRect | null
  onClose: () => void
  onViewReport?: () => void
  onToggleMute: () => void
  onLeaveChat: () => void
  onOpenProfile: () => void
  onBlock: () => void
}) {
  const { t } = useT("conversation")
  const items: PopoverMenuItem[] = isReport
    ? [
        ...(onViewReport
          ? [
              {
                key: "view-report",
                label: t("overflow.view_report"),
                accessibilityLabel: t("overflow.view_report_label"),
                icon: "MapPin" as const,
                onPress: onViewReport,
              },
            ]
          : []),
        {
          key: "mute",
          label: muted ? t("overflow.unmute") : t("overflow.mute"),
          accessibilityLabel: muted ? t("overflow.unmute_label") : t("overflow.mute_label"),
          icon: muted ? ("Bell" as const) : ("BellOff" as const),
          onPress: onToggleMute,
        },
        {
          key: "leave",
          label: t("overflow.leave"),
          accessibilityLabel: t("overflow.leave_label"),
          icon: "LogOut" as const,
          destructive: true,
          onPress: onLeaveChat,
        },
      ]
    : [
        {
          key: "profile",
          label: t("overflow.open_profile"),
          accessibilityLabel: t("overflow.open_profile_label"),
          icon: "User" as const,
          onPress: onOpenProfile,
        },
        {
          key: "block",
          label: t("overflow.block"),
          accessibilityLabel: t("overflow.block_label"),
          icon: "Ban" as const,
          destructive: true,
          onPress: onBlock,
        },
      ]
  return <PopoverMenu visible={visible} onClose={onClose} anchorRect={anchorRect} items={items} />
}

export function BlockConfirmCard({
  name,
  isDm,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string
  isDm: boolean
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const styles = useConversationStyles()
  const { t } = useT("conversation")
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmText}>
        {isDm ? t("block_confirm.prompt_dm", { name }) : t("block_confirm.prompt_group", { name })}
      </Text>
      <View style={styles.confirmRow}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("block_confirm.cancel")}
          {...focusRingProps}
          style={({ pressed }) => [styles.confirmCancel, pressed ? styles.pressed : null]}
        >
          <Text style={styles.confirmCancelText}>{t("block_confirm.cancel")}</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={t("block_confirm.block")}
          {...focusRingProps}
          style={({ pressed }) => [styles.confirmBlock, pressed ? styles.pressed : null]}
        >
          <Text style={styles.confirmBlockText}>{t("block_confirm.block")}</Text>
        </Pressable>
      </View>
    </View>
  )
}
