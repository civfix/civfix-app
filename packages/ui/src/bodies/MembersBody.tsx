import React, { memo, useCallback, useMemo, useState } from "react"
import { View, Pressable, Image, Modal, StyleSheet } from "react-native"
import type { CleanupMemberRole, EventSlotDTO, EventSlotRef, PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, headingLevel, focusRingProps, webScrimProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import {
  EmptyState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  useToast,
} from "../primitives"
import {
  useCleanup,
  useCleanupAttendees,
  useGroupMembers,
  useReport,
  useReportChatParticipants,
  useLeaveReportChat,
  useToggleMute,
  useThreads,
  useSetMemberRole,
  useRemoveMember,
  useBlockUser,
  useAuthState,
} from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { RosterRow, type RosterRowMenu } from "./RosterRow"
import { RoleChip } from "./RoleChip"
import { canLeaveChat, chatMemberCount, isChatInfoRoomKind } from "./chatInfoSurface"
import { chatInfoRosterView } from "./chatInfoVisibility"
import { FeedNotice } from "./FeedNotice"
import { cleanupHostStanding, hasHostCapability } from "../data/hooks/host"
import {
  settableRolesOtherThan,
  type SettableEventMemberRole,
} from "./host/eventTeamTiers"
import { groupRosterBySlot, rosterListKey, type RosterListItem } from "./rosterSlotGroups"
import { SlotGroupHeader } from "./SlotGroupHeader"

type RosterPerson = PersonDTO & { role?: CleanupMemberRole; slot?: EventSlotRef | null }

type RosterListRow = RosterListItem<RosterPerson>
type RosterItem = RosterPerson | RosterListRow

const NO_SLOTS: readonly EventSlotDTO[] = []

function rosterItemKey(item: RosterItem): string {
  return "kind" in item ? rosterListKey(item) : item.id
}

const MemberRow = memo(function MemberRow({
  person,
  viewerId,
  viewerManagesTeam,
  viewerManagesEvent,
  onOpenPerson,
  onBlock,
  onSetRole,
  onRemove,
  blockPending,
  managePending,
  showSlotChip,
}: {
  person: RosterPerson
  viewerId: string | null
  viewerManagesTeam: boolean
  viewerManagesEvent: boolean
  onOpenPerson: (navId: string) => void
  onBlock: (personId: string) => void
  onSetRole: (personId: string, role: SettableEventMemberRole) => void
  onRemove: (personId: string) => void
  blockPending: boolean
  managePending: boolean
  showSlotChip: boolean
}) {
  const styles = useStyles()
  const { t } = useT("event-members")
  const { t: tEnums } = useT("enums")

  const canBlock = !person.deleted && !!viewerId && person.id !== viewerId
  const targetRole: CleanupMemberRole | undefined = person.role
  const isSelf = !!viewerId && person.id === viewerId
  const manageable =
    !person.deleted && !isSelf && !!viewerId && targetRole != null && targetRole !== "organizer"
  const canSetRole = manageable && viewerManagesTeam
  const canRemove =
    manageable && (viewerManagesTeam || (viewerManagesEvent && targetRole === "member"))
  const hasKebab = canBlock || canSetRole || canRemove

  const menu: RosterRowMenu | null = hasKebab
    ? {
        a11yLabel: t("row.moreOptionsA11y", { name: person.name }),
        buildItems: (goToConfirm) => [
          ...(canSetRole
            ? settableRolesOtherThan(targetRole).map((role) => ({
                key: `role-${role}`,
                label: t("manage.make_role", { role: tEnums(`cleanupMemberRole.${role}`) }),
                icon: role === "member" ? ("UserMinus" as IconName) : ("UserPlus" as IconName),
                disabled: managePending,
                onPress: () => onSetRole(person.id, role),
              }))
            : []),
          ...(canRemove
            ? [
                {
                  key: "remove",
                  label: t("manage.remove"),
                  icon: "UserMinus" as const,
                  destructive: true,
                  onPress: () => goToConfirm("confirm-remove"),
                },
              ]
            : []),
          ...(canBlock
            ? [
                {
                  key: "block",
                  label: t("block.action"),
                  icon: "Ban" as const,
                  destructive: true,
                  onPress: () => goToConfirm("confirm-block"),
                },
              ]
            : []),
        ],
        confirmSteps: {
          "confirm-block": [
            { key: "cancel", label: t("block.cancel"), onPress: () => {} },
            {
              key: "confirm-block",
              label: t("block.confirm"),
              icon: "Ban",
              destructive: true,
              disabled: blockPending,
              onPress: () => onBlock(person.id),
            },
          ],
          "confirm-remove": [
            { key: "cancel", label: t("manage.removeCancel"), onPress: () => {} },
            {
              key: "confirm-remove",
              label: t("manage.removeConfirm"),
              icon: "UserMinus",
              destructive: true,
              disabled: managePending,
              onPress: () => onRemove(person.id),
            },
          ],
        },
      }
    : null

  const roleChip =
    targetRole === "organizer" ? (
      <RoleChip label={t("role.host")} tone="lead" />
    ) : targetRole != null && targetRole !== "member" ? (
      <RoleChip label={tEnums(`cleanupMemberRole.${targetRole}`)} />
    ) : null

  const slotTitle = showSlotChip ? person.slot?.title : undefined
  const slotChip = slotTitle ? <RoleChip label={slotTitle} tone="slot" /> : null

  return (
    <RosterRow
      person={person}
      onOpenPerson={onOpenPerson}
      openA11yLabel={t("row.viewProfileA11y", { name: person.name })}
      nameSuffix={
        roleChip || slotChip ? (
          <View style={styles.chipRow}>
            {roleChip}
            {slotChip}
          </View>
        ) : null
      }
      menu={menu}
    />
  )
})

function LinkedEntityRow({
  icon,
  label,
  a11y,
  onPress,
}: {
  icon: "MapPin" | "Calendar"
  label: string
  a11y: string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      {...focusRingProps}
      style={({ pressed }) => [styles.linkedRow, pressed ? styles.linkedRowPressed : null]}
    >
      <View style={styles.linkedIcon}>
        <Icon icon={iconMap[icon]} size={17} color={th.colors.brand.moss} />
      </View>
      <Text style={styles.linkedLabel} numberOfLines={1}>
        {label}
      </Text>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

function ActionRow({
  icon,
  label,
  a11y,
  destructive,
  disabled,
  onPress,
}: {
  icon: IconName
  label: string
  a11y?: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.actionRow,
        pressed ? styles.rowPressed : null,
        disabled ? styles.actionDisabled : null,
      ]}
    >
      <Icon
        icon={iconMap[icon]}
        size={18}
        color={destructive ? th.colors.bloom["600"] : th.colors.text}
      />
      <Text style={[styles.actionLabel, destructive ? styles.actionLabelDestructive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

function ChatInfoHero({
  imageUrl,
  glyph,
  title,
  subtitle,
  memberLine,
}: {
  imageUrl: string | null
  glyph: IconName
  title: string
  subtitle: string | null
  memberLine: string
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.hero}>
      <View style={[styles.heroAvatar, imageUrl ? styles.heroAvatarFramed : null]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.heroAvatarImage} resizeMode="cover" />
        ) : (
          <Icon icon={iconMap[glyph]} size={34} color={th.colors.onAccent} />
        )}
      </View>
      <Text
        style={styles.heroName}
        numberOfLines={2}
        accessibilityRole="header"
        {...headingLevel(2)}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <Text style={styles.heroMembers}>{memberLine}</Text>
    </View>
  )
}

export interface MembersBodyProps {
  id: string
  roomKind?: "cleanup" | "dm" | "report" | "group"
  onOpenPerson?: (navId: string) => void
  onOpenReport?: () => void
  onOpenEvent?: () => void
  onLeft?: () => void
}

export function MembersBody({
  id,
  roomKind = "cleanup",
  onOpenPerson: onOpenPersonProp,
  onOpenReport: onOpenReportProp,
  onOpenEvent: onOpenEventProp,
  onLeft: onLeftProp,
}: MembersBodyProps) {
  const styles = useStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
  const { t } = useT("event-members")
  const { t: tSlots } = useT("event-slots")
  const { t: tCommon } = useT("common")
  const toast = useToast()
  const attendeesQuery = useCleanupAttendees(roomKind === "cleanup" ? id : undefined)
  const groupQuery = useGroupMembers(roomKind === "group" ? id : undefined)
  const reportRosterQuery = useReportChatParticipants(roomKind === "report" ? id : undefined)
  const query =
    roomKind === "group" ? groupQuery : roomKind === "report" ? reportRosterQuery : attendeesQuery
  const groupPages = groupQuery.data
  const reportRoster = reportRosterQuery.data
  const attendeeRoster = attendeesQuery.data
  const items: RosterPerson[] = useMemo(
    () =>
      roomKind === "group"
        ? (groupPages?.pages ?? []).flatMap((p) => p.members.map((m) => m.user))
        : roomKind === "report"
          ? (reportRoster?.participants ?? []).map((p) => p.user)
          : attendeeRoster?.attendees ?? [],
    [roomKind, groupPages, reportRoster, attendeeRoster],
  )
  const viewerId = useAuthState().user?.id ?? null
  const blockUser = useBlockUser()

  const cleanupQuery = useCleanup(roomKind === "cleanup" ? id : undefined)
  const viewerStanding = cleanupHostStanding(cleanupQuery.data, viewerId)
  const viewerManagesTeam = hasHostCapability(viewerStanding, "manage_team")
  const viewerManagesEvent = hasHostCapability(viewerStanding, "manage_event")
  const setMemberRole = useSetMemberRole()
  const removeMember = useRemoveMember()
  const managePending = setMemberRole.isPending || removeMember.isPending

  const cleanupTimeZone = cleanupQuery.data?.timezone ?? undefined
  const cleanupSlots: readonly EventSlotDTO[] = cleanupQuery.data?.slots ?? NO_SLOTS
  const grouped =
    roomKind === "cleanup" && cleanupSlots.length > 0 && attendeeRoster?.scope === "all"
  const data: RosterItem[] = useMemo(
    () =>
      grouped
        ? groupRosterBySlot(items, cleanupSlots, {
            unassignedTitle: tSlots("roster.unassigned"),
            emptySlotTitle: tSlots("roster.empty_slot"),
          })
        : items,
    [grouped, items, cleanupSlots, tSlots],
  )

  const onOpenPerson = useCallback(
    (navId: string) => {
      if (onOpenPersonProp) onOpenPersonProp(navId)
      else useNavStore.getState().push({ kind: "person", id: navId })
    },
    [onOpenPersonProp],
  )

  const onOpenReport = useCallback(() => {
    if (onOpenReportProp) onOpenReportProp()
    else useNavStore.getState().push({ kind: "pin", id })
  }, [onOpenReportProp, id])

  const onOpenEvent = useCallback(() => {
    if (onOpenEventProp) onOpenEventProp()
    else useNavStore.getState().push({ kind: "cleanup", id })
  }, [onOpenEventProp, id])

  const onMutationError = useCallback(() => {
    toast.show(tCommon("error_generic"), { variant: "error" })
  }, [toast, tCommon])

  const isInfoSurface = isChatInfoRoomKind(roomKind)
  const reportQuery = useReport(roomKind === "report" ? id : undefined)
  const report = reportQuery.data
  const cleanup = cleanupQuery.data

  const threads = useThreads()
  const threadRow = useMemo(
    () =>
      (threads.data?.pages ?? [])
        .flatMap((p) => p.items)
        .find((thr) => (thr.refId ?? thr.id) === id),
    [threads.data, id],
  )
  const muted = threadRow?.muted ?? false
  const toggleMute = useToggleMute(roomKind === "report" ? "report" : "cleanup", id)
  const onToggleMute = useCallback(() => {
    toggleMute.mutate({ muted: !muted }, { onError: onMutationError })
  }, [toggleMute, muted, onMutationError])

  const leaveReportChat = useLeaveReportChat()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const canLeave = canLeaveChat(roomKind, report?.chatJoined)
  const onConfirmLeave = useCallback(() => {
    leaveReportChat.mutate(id, {
      onSuccess: () => {
        setLeaveOpen(false)
        if (onLeftProp) onLeftProp()
        else useNavStore.getState().back()
      },
      onError: () => {
        setLeaveOpen(false)
        onMutationError()
      },
    })
  }, [leaveReportChat, id, onLeftProp, onMutationError])

  const memberCount =
    roomKind === "report"
      ? chatMemberCount(reportRosterQuery.data?.total, report?.chatMemberCount)
      : chatMemberCount(cleanup?.going, attendeesQuery.data?.going)

  const roster = chatInfoRosterView({
    roomKind,
    scope: attendeeRoster?.scope,
    going: memberCount,
    shown: items.length,
    participant: cleanup?.joined,
  })

  const onBlock = useCallback(
    (personId: string) => {
      blockUser.mutate(personId, { onError: onMutationError })
    },
    [blockUser, onMutationError],
  )

  const onSetRole = useCallback(
    (personId: string, role: SettableEventMemberRole) => {
      setMemberRole.mutate({ id, userId: personId, role }, { onError: onMutationError })
    },
    [setMemberRole, id, onMutationError],
  )

  const onRemove = useCallback(
    (personId: string) => {
      removeMember.mutate({ id, userId: personId }, { onError: onMutationError })
    },
    [removeMember, id, onMutationError],
  )

  const renderItem = useCallback(
    ({ item }: { item: RosterItem }) => {
      if ("kind" in item) {
        if (item.kind === "slot-header") {
          return (
            <SlotGroupHeader
              title={item.title}
              claimed={item.claimed}
              capacity={item.capacity}
              startsAt={item.startsAt}
              endsAt={item.endsAt}
              timeZone={cleanupTimeZone}
            />
          )
        }
        if (item.kind === "slot-empty") {
          return <Text style={styles.slotEmpty}>{item.title}</Text>
        }
      }
      const person = "kind" in item ? item.person : item
      return (
        <MemberRow
          person={person}
          viewerId={viewerId}
          viewerManagesTeam={viewerManagesTeam}
          viewerManagesEvent={viewerManagesEvent}
          onOpenPerson={onOpenPerson}
          onBlock={onBlock}
          onSetRole={onSetRole}
          onRemove={onRemove}
          blockPending={blockUser.isPending}
          managePending={managePending}
          showSlotChip={!grouped}
        />
      )
    },
    [
      onOpenPerson,
      onBlock,
      onSetRole,
      onRemove,
      viewerId,
      viewerManagesTeam,
      viewerManagesEvent,
      blockUser.isPending,
      managePending,
      grouped,
      cleanupTimeZone,
    ],
  )

  const linkedRow =
    roomKind === "report" ? (
      <LinkedEntityRow
        icon="MapPin"
        label={t("cta.view_report")}
        a11y={t("cta.view_report_a11y")}
        onPress={onOpenReport}
      />
    ) : roomKind === "cleanup" ? (
      <LinkedEntityRow
        icon="Calendar"
        label={t("cta.view_event")}
        a11y={t("cta.view_event_a11y")}
        onPress={onOpenEvent}
      />
    ) : null

  const infoHeader = isInfoSurface ? (
    <View>
      <ChatInfoHero
        imageUrl={roomKind === "report" ? report?.media?.[0]?.url ?? null : null}
        glyph={roomKind === "report" ? "MapPin" : "Calendar"}
        title={
          roomKind === "report"
            ? report?.title?.trim() || t("hero.report_fallback")
            : cleanup?.title ?? ""
        }
        subtitle={roomKind === "report" ? report?.addr ?? null : cleanup?.address ?? null}
        memberLine={
          roster.access === "followed-only"
            ? t("hero.members_partial", { shown: roster.shown, going: roster.going })
            : t("hero.members", { count: memberCount })
        }
      />
      {roster.canMute || canLeave ? (
        <View style={styles.actions}>
          {roster.canMute ? (
            <ActionRow
              icon={muted ? "BellOff" : "Bell"}
              label={muted ? t("action.unmute") : t("action.mute")}
              disabled={toggleMute.isPending}
              onPress={onToggleMute}
            />
          ) : null}
          {canLeave ? (
            <ActionRow
              icon="LogOut"
              label={t("action.leave")}
              destructive
              onPress={() => setLeaveOpen(true)}
            />
          ) : null}
        </View>
      ) : null}
      {linkedRow}
      {roster.showRestrictedNotice ? (
        <FeedNotice icon="Lock" title={t("restricted.title")} body={t("restricted.body")} />
      ) : null}
      <Text style={styles.sectionLabel}>{t("section.members")}</Text>
    </View>
  ) : (
    linkedRow
  )

  return (
    <>
    <FlatList
      data={data}
      keyExtractor={rosterItemKey}
      style={styles.list}
      contentContainerStyle={
        data.length === 0 && !isInfoSurface ? styles.listEmpty : styles.listContent
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (roomKind === "group" && groupQuery.hasNextPage && !groupQuery.isFetchingNextPage) {
          void groupQuery.fetchNextPage()
        }
      }}
      renderItem={renderItem}
      ListHeaderComponent={infoHeader}
      ListEmptyComponent={
        query.isLoading ? (
          <LoadingState skeleton="person" rows={8} />
        ) : query.isError ? (
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.CloudOff}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("error.title")}
            body={t("error.body")}
          />
        ) : roster.access === "followed-only" ? (
          <EmptyState
            variant="detail"
            tone="neutral"
            icon={iconMap.Lock}
            iconColor={th.colors.textSubtle}
            iconSize={30}
            title={t("restricted.title")}
            body={t("restricted.empty_body")}
          />
        ) : (
          <EmptyState
            variant="detail"
            icon={iconMap.Users}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        )
      }
    />
    <Modal
      visible={leaveOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setLeaveOpen(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("leave.dismiss")}
          onPress={() => setLeaveOpen(false)}
          {...webScrimProps}
        />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={styles.card}>
            <Text variant="bodyStrong" color={th.colors.text}>
              {t("action.leave")}
            </Text>
            <Text style={styles.confirmBody}>{t("leave.confirm")}</Text>
            <View style={styles.cardActions}>
              <SecondaryButton
                label={t("leave.cancel")}
                onPress={() => setLeaveOpen(false)}
                size="sm"
              />
              <PrimaryButton
                label={t("leave.action")}
                variant="destructive"
                onPress={onConfirmLeave}
                loading={leaveReportChat.isPending}
                disabled={leaveReportChat.isPending}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
  },
  reportOnly: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 12,
    paddingHorizontal: t.space["3"],
    marginBottom: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  linkedRowPressed: {
    opacity: 0.7,
  },
  hero: {
    alignItems: "center",
    paddingTop: t.space["2"],
    paddingBottom: t.space["4"],
    gap: t.space["2"],
  },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.moss,
  },
  heroAvatarFramed: t.imageFrame,
  heroAvatarImage: {
    width: "100%",
    height: "100%",
  },
  heroName: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 19,
    color: t.colors.text,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    color: t.colors.textMuted,
    textAlign: "center",
  },
  heroMembers: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textSubtle,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    paddingVertical: t.space["1"],
    marginBottom: t.space["3"],
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: 12,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    color: t.colors.text,
  },
  actionLabelDestructive: {
    color: t.colors.bloom["600"],
  },
  rowPressed: {
    opacity: 0.7,
  },
  sectionLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: t.space["2"],
    paddingTop: t.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    marginBottom: t.space["2"],
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  modalCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
  },
  card: {
    width: "100%",
    maxWidth: 460,
    gap: t.space["3"],
    padding: t.space["4"],
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  confirmBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14.5,
    color: t.colors.textMuted,
  },
  linkedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  linkedLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    color: t.colors.text,
  },
  listContent: {
    paddingHorizontal: t.space["4"],
    paddingTop: 0,
    paddingBottom: t.space["8"],
  },
  listEmpty: {
    flexGrow: 1,
    paddingHorizontal: t.space["4"],
  },
  chipRow: {
    flexDirection: "row",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  slotEmpty: {
    paddingVertical: t.space["2"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textSubtle,
  },
}))
