import React, { memo, useCallback, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { ChatGroupDTO, GroupMemberDTO, GroupRole, PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import {
  EmptyState,
  LoadingState,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  useToast,
} from "../primitives"
import type { PopoverMenuItem } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { useClipboard } from "../capabilities"
import {
  useGroupInfo,
  useGroupMembers,
  useAddGroupMembers,
  useUpdateGroup,
  useRemoveGroupMember,
  useSetGroupMemberRole,
  useToggleMute,
  useAuthState,
} from "../data"
import { pathForEntry, useNavStore } from "../nav"
import { absoluteUrl } from "../primitives/share"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { MemberPicker } from "./MemberPicker"
import { ChatInfoActionRow, ChatInfoHero } from "./ChatInfoParts"
import { RosterRow, type RosterRowMenu } from "./RosterRow"
import { GroupIdentityFields } from "./GroupIdentityFields"
import { groupMemberActions, type GroupMemberActionKey } from "./groupMemberActions"
import { canCreateGroup, normalizeGroupDraft } from "./groupWizard"

export interface GroupInfoBodyProps {
  id: string
  onBack?: () => void
  onOpenPerson?: (navId: string) => void
}

const GroupMemberRow = memo(function GroupMemberRow({
  member,
  viewerRole,
  viewerId,
  onOpenPerson,
  onAction,
  actionPending,
}: {
  member: GroupMemberDTO
  viewerRole: GroupRole | null
  viewerId: string | null
  onOpenPerson: (navId: string) => void
  onAction: (action: GroupMemberActionKey, userId: string) => void
  actionPending: boolean
}) {
  const styles = useStyles()
  const { t } = useT("group-info")

  const person: PersonDTO = member.user
  const isSelf = viewerId !== null && person.id === viewerId
  const actions = person.deleted ? [] : groupMemberActions(viewerRole, member.role, isSelf)

  const roleLabel =
    member.role === "owner" ? t("role_owner") : member.role === "admin" ? t("role_admin") : null

  const menu: RosterRowMenu | null =
    actions.length > 0
      ? {
          a11yLabel: t("row.manage_a11y", { name: person.name }),
          buildItems: (goToConfirm) =>
            actions.map((action): PopoverMenuItem => {
              switch (action) {
                case "make-admin":
                  return {
                    key: action,
                    label: t("make_admin"),
                    icon: "Award" as IconName,
                    onPress: () => onAction("make-admin", person.id),
                  }
                case "remove-admin":
                  return {
                    key: action,
                    label: t("remove_admin"),
                    icon: "Close" as IconName,
                    onPress: () => onAction("remove-admin", person.id),
                  }
                case "remove":
                  return {
                    key: action,
                    label: t("remove_member"),
                    icon: "Trash2" as IconName,
                    destructive: true,
                    onPress: () => goToConfirm("confirm-remove"),
                  }
              }
            }),
          confirmSteps: {
            "confirm-remove": [
              { key: "cancel", label: t("cancel"), onPress: () => {} },
              {
                key: "confirm-remove",
                label: t("remove_member_confirm"),
                icon: "Trash2",
                destructive: true,
                disabled: actionPending,
                onPress: () => onAction("remove", person.id),
              },
            ],
          },
        }
      : null

  return (
    <RosterRow
      person={person}
      onOpenPerson={onOpenPerson}
      openA11yLabel={t("row.view_profile_a11y", { name: person.name })}
      trailing={
        roleLabel ? (
          <Text style={styles.roleLabel} numberOfLines={1}>
            {roleLabel}
          </Text>
        ) : null
      }
      menu={menu}
    />
  )
})

function useAddMembersSheet(id: string) {
  const addMembers = useAddGroupMembers()
  // Claimed synchronously: `isPending` lags a same-frame double activation (double click, key repeat).
  const addingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PersonDTO[]>([])
  const [error, setError] = useState(false)
  const openSheet = useCallback(() => {
    setSelected([])
    setError(false)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const onConfirm = useCallback(() => {
    if (addingRef.current) return
    if (selected.length === 0 || addMembers.isPending) return
    addingRef.current = true
    setError(false)
    addMembers.mutate(
      { id, memberIds: selected.map((p) => p.id) },
      {
        onSuccess: () => setOpen(false),
        onError: () => setError(true),
        onSettled: () => {
          addingRef.current = false
        },
      },
    )
  }, [selected, addMembers, id])
  return { open, openSheet, close, selected, setSelected, error, pending: addMembers.isPending, onConfirm }
}

function AddMembersSheet({
  sheet,
  excludeIds,
}: {
  sheet: ReturnType<typeof useAddMembersSheet>
  excludeIds: string[]
}) {
  const styles = useStyles()
  const { t } = useT("group-info")
  return (
    <ModalCardSheet
      visible={sheet.open}
      onClose={sheet.close}
      headerIcon="UserPlus"
      title={t("add_members")}
      dismissLabel={t("sheet_dismiss")}
      error={sheet.error ? t("add_error") : null}
      bodyLayout="fill"
      cardStyle={styles.addCard}
      actions={
        <>
          <SecondaryButton label={t("cancel")} onPress={sheet.close} size="sm" />
          <PrimaryButton
            label={t("add")}
            onPress={sheet.onConfirm}
            loading={sheet.pending}
            disabled={sheet.selected.length === 0 || sheet.pending}
          />
        </>
      }
    >
      <MemberPicker selected={sheet.selected} onChange={sheet.setSelected} excludeIds={excludeIds} />
    </ModalCardSheet>
  )
}

function useEditGroupSheet({ id, group, isOwner }: { id: string; group: ChatGroupDTO | undefined; isOwner: boolean }) {
  const updateGroup = useUpdateGroup()
  const savingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"private" | "public">("private")
  const [error, setError] = useState(false)
  const avatar = useComposerAttachments(1)
  const picked = avatar.attachments[0] ?? null

  const openSheet = useCallback(() => {
    setName(group?.name ?? "")
    setDescription(group?.description ?? "")
    setVisibility(group?.visibility ?? "private")
    setError(false)
    if (picked) avatar.removeAttachment(picked.id)
    setOpen(true)
  }, [group?.name, group?.description, group?.visibility, picked, avatar])
  const close = useCallback(() => setOpen(false), [])
  const valid = canCreateGroup(name, description)
  const onSave = useCallback(() => {
    if (savingRef.current) return
    if (!valid || avatar.uploading || updateGroup.isPending) return
    savingRef.current = true
    setError(false)
    const draft = normalizeGroupDraft(name, description)
    updateGroup.mutate(
      {
        id,
        name: draft.name,
        description: draft.description ?? "",
        ...(isOwner && visibility !== group?.visibility ? { visibility } : {}),
        ...(picked?.uploadId ? { avatarUploadId: picked.uploadId } : {}),
      },
      {
        onSuccess: () => {
          if (picked) avatar.removeAttachment(picked.id)
          setOpen(false)
        },
        onError: () => setError(true),
        onSettled: () => {
          savingRef.current = false
        },
      },
    )
  }, [valid, avatar, updateGroup, id, name, description, visibility, isOwner, group?.visibility, picked])
  return {
    open,
    openSheet,
    close,
    name,
    setName,
    description,
    setDescription,
    visibility,
    setVisibility,
    error,
    avatar,
    valid,
    pending: updateGroup.isPending,
    onSave,
  }
}

function EditGroupSheet({
  sheet,
  isOwner,
  fallbackAvatarUrl,
}: {
  sheet: ReturnType<typeof useEditGroupSheet>
  isOwner: boolean
  fallbackAvatarUrl: string | null
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("group-info")
  return (
    <ModalCardSheet
      visible={sheet.open}
      onClose={sheet.close}
      headerIcon="Pencil"
      title={t("edit_info")}
      dismissLabel={t("sheet_dismiss")}
      error={sheet.error ? t("edit_error") : null}
      actions={
        <>
          <SecondaryButton label={t("cancel")} onPress={sheet.close} size="sm" />
          <PrimaryButton
            label={t("save")}
            onPress={sheet.onSave}
            loading={sheet.pending}
            disabled={!sheet.valid || sheet.avatar.uploading || sheet.pending}
          />
        </>
      }
    >
      <GroupIdentityFields
        variant="sheet"
        avatar={sheet.avatar}
        name={sheet.name}
        onChangeName={sheet.setName}
        description={sheet.description}
        onChangeDescription={sheet.setDescription}
        fallbackAvatarUrl={fallbackAvatarUrl}
        labels={{
          avatarA11y: t("avatar_a11y"),
          avatarClearA11y: t("avatar_clear_a11y"),
          nameLabel: t("name_label"),
          namePlaceholder: t("name_placeholder"),
          descriptionLabel: t("description_label"),
          descriptionPlaceholder: t("description_placeholder"),
        }}
      />
      {isOwner ? (
        <View style={styles.visibilityEdit}>
          <Text style={styles.visibilityEditLabel}>{t("visibility_label")}</Text>
          <View
            style={styles.visibilitySegment}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("visibility_label")}
          >
            {(["private", "public"] as const).map((v) => {
              const active = sheet.visibility === v
              return (
                <Pressable
                  key={v}
                  onPress={() => sheet.setVisibility(v)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t(v === "public" ? "visibility_public" : "visibility_private")}
                  {...focusRingProps}
                  style={({ pressed }) => [
                    styles.visibilityOption,
                    active ? styles.visibilityOptionActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Icon
                    icon={iconMap[v === "public" ? "Globe" : "Lock"]}
                    size={15}
                    color={active ? th.colors.brand.moss : th.colors.textMuted}
                  />
                  <Text style={[styles.visibilityOptionText, active ? styles.visibilityOptionTextActive : null]}>
                    {t(v === "public" ? "visibility_public" : "visibility_private")}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}
    </ModalCardSheet>
  )
}

function useLeaveGroupSheet({
  id,
  viewerId,
  removeMember,
  onBack,
}: {
  id: string
  viewerId: string | null
  removeMember: ReturnType<typeof useRemoveGroupMember>
  onBack?: () => void
}) {
  const leavingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const openSheet = useCallback(() => {
    setError(false)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  const onConfirm = useCallback(() => {
    if (leavingRef.current) return
    if (!viewerId || removeMember.isPending) return
    leavingRef.current = true
    setError(false)
    removeMember.mutate(
      { id, userId: viewerId },
      {
        onSuccess: () => {
          setOpen(false)
          if (onBack) onBack()
          else useNavStore.getState().setStack([{ kind: "messages" }])
        },
        onError: () => setError(true),
        onSettled: () => {
          leavingRef.current = false
        },
      },
    )
  }, [viewerId, removeMember, id, onBack])
  return { open, openSheet, close, error, pending: removeMember.isPending, onConfirm }
}

function LeaveGroupSheet({
  sheet,
  isChannel,
  groupName,
}: {
  sheet: ReturnType<typeof useLeaveGroupSheet>
  isChannel: boolean
  groupName: string
}) {
  const styles = useStyles()
  const { t } = useT("group-info")
  return (
    <ModalCardSheet
      visible={sheet.open}
      onClose={sheet.close}
      headerIcon="LogOut"
      title={isChannel ? t("leave_channel") : t("leave")}
      dismissLabel={t("sheet_dismiss")}
      error={sheet.error ? t("leave_error") : null}
      actions={
        <>
          <SecondaryButton label={t("cancel")} onPress={sheet.close} size="sm" />
          <PrimaryButton
            label={t("leave_action")}
            variant="destructive"
            onPress={sheet.onConfirm}
            loading={sheet.pending}
            disabled={sheet.pending}
          />
        </>
      }
    >
      <Text style={styles.confirmBody}>{t("leave_confirm", { name: groupName })}</Text>
    </ModalCardSheet>
  )
}

export function GroupInfoBody({ id, onBack, onOpenPerson: onOpenPersonProp }: GroupInfoBodyProps) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("group-info")

  const info = useGroupInfo(id)
  const members = useGroupMembers(id)
  const group = info.data
  const viewerRole: GroupRole | null = group?.myRole ?? null
  const viewerId = useAuthState().user?.id ?? null
  const canManage = viewerRole === "owner" || viewerRole === "admin"
  const isChannel = group?.kind === "channel"
  const isOwner = viewerRole === "owner"
  const isPublic = group?.visibility === "public"
  const clipboard = useClipboard()
  const toast = useToast()

  const toggleMute = useToggleMute("group", id)
  const removeMember = useRemoveGroupMember()
  const setRole = useSetGroupMemberRole()
  const addSheet = useAddMembersSheet(id)
  const editSheet = useEditGroupSheet({ id, group, isOwner })
  const leaveSheet = useLeaveGroupSheet({ id, viewerId, removeMember, onBack })

  const onToggleMute = useCallback(() => {
    toggleMute.mutate({ muted: !(group?.muted ?? false) })
  }, [toggleMute, group?.muted])

  const addExcludeIds = useMemo(() => {
    const ids = (members.data?.pages ?? []).flatMap((p) => p.members.map((m) => m.user.id))
    if (viewerId && !ids.includes(viewerId)) ids.push(viewerId)
    return ids
  }, [members.data, viewerId])

  const onOpenPerson = useCallback(
    (navId: string) => {
      if (onOpenPersonProp) onOpenPersonProp(navId)
      else useNavStore.getState().push({ kind: "person", id: navId })
    },
    [onOpenPersonProp],
  )

  const onCopyLink = useCallback(() => {
    if (!clipboard) return
    void clipboard
      .setString(absoluteUrl(pathForEntry({ kind: "thread", id, roomKind: "group" })))
      .then(() => toast.show(t("link_copied"), { variant: "success" }))
      .catch(() => toast.show(t("link_copy_failed"), { variant: "error" }))
  }, [clipboard, id, toast, t])

  const onRowActionError = useCallback(() => {
    toast.show(t("action_error"), { variant: "error" })
  }, [toast, t])

  const onRowAction = useCallback(
    (action: GroupMemberActionKey, userId: string) => {
      if (action === "remove") removeMember.mutate({ id, userId }, { onError: onRowActionError })
      else
        setRole.mutate(
          { id, userId, role: action === "make-admin" ? "admin" : "member" },
          { onError: onRowActionError },
        )
    },
    [removeMember, setRole, id, onRowActionError],
  )
  const rowActionPending = removeMember.isPending || setRole.isPending

  const items: GroupMemberDTO[] = useMemo(
    () => (members.data?.pages ?? []).flatMap((p) => p.members),
    [members.data],
  )

  const renderItem = useCallback(
    ({ item }: { item: GroupMemberDTO }) => (
      <GroupMemberRow
        member={item}
        viewerRole={viewerRole}
        viewerId={viewerId}
        onOpenPerson={onOpenPerson}
        onAction={onRowAction}
        actionPending={rowActionPending}
      />
    ),
    [viewerRole, viewerId, onOpenPerson, onRowAction, rowActionPending],
  )

  const memberCount = group?.memberCount ?? 0

  const header = (
    <View>
      <ChatInfoHero
        imageUrl={group?.avatar?.url ?? null}
        glyph="Users"
        title={group?.name ?? ""}
        badge={
          group?.kind === "channel" ? (
            <View style={styles.kindBadge}>
              <Icon icon={iconMap.Megaphone} size={12} color={th.colors.textMuted} />
              <Text style={styles.kindBadgeText}>{t("kind_channel")}</Text>
            </View>
          ) : null
        }
        subtitle={group?.description ?? null}
        memberLine={
          isChannel ? t("subscribers", { count: memberCount }) : t("members", { count: memberCount })
        }
        footer={
          isOwner && group ? (
            <View style={styles.visibilityRow}>
              <Icon
                icon={iconMap[isPublic ? "Globe" : "Lock"]}
                size={13}
                color={th.colors.textSubtle}
              />
              <Text style={styles.visibilityText}>
                {isPublic ? t("visibility_public") : t("visibility_private")}
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.actions}>
        <ChatInfoActionRow
          icon={group?.muted ? "BellOff" : "Bell"}
          label={group?.muted ? t("unmute") : t("mute")}
          disabled={toggleMute.isPending || !group}
          onPress={onToggleMute}
        />
        {canManage ? <ChatInfoActionRow icon="UserPlus" label={isChannel ? t("add_subscribers") : t("add_members")} onPress={addSheet.openSheet} /> : null}
        {canManage ? <ChatInfoActionRow icon="Pencil" label={t("edit_info")} onPress={editSheet.openSheet} /> : null}
        {isChannel && isPublic && clipboard ? (
          <ChatInfoActionRow icon="Link2" label={t("copy_link")} onPress={onCopyLink} />
        ) : null}
        {viewerRole === "admin" || viewerRole === "member" ? (
          <ChatInfoActionRow
            icon="LogOut"
            label={isChannel ? t("leave_channel") : t("leave")}
            destructive
            onPress={leaveSheet.openSheet}
          />
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>{isChannel ? t("subscribers_section") : t("members_section")}</Text>
    </View>
  )

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={memberKeyExtractor}
        style={styles.list}
        contentContainerStyle={items.length === 0 ? styles.listEmpty : styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (members.hasNextPage && !members.isFetchingNextPage) void members.fetchNextPage()
        }}
        renderItem={renderItem}
        ListEmptyComponent={
          info.isLoading || members.isLoading ? (
            <LoadingState skeleton="person" rows={8} />
          ) : info.isError || members.isError ? (
            <EmptyState
              variant="detail"
              tone="neutral"
              icon={iconMap.CloudOff}
              iconColor={th.colors.textSubtle}
              iconSize={30}
              title={t("error.title")}
              body={t("error.body")}
            />
          ) : null
        }
      />

      <AddMembersSheet sheet={addSheet} excludeIds={addExcludeIds} />
      <EditGroupSheet sheet={editSheet} isOwner={isOwner} fallbackAvatarUrl={group?.avatar?.url ?? null} />
      <LeaveGroupSheet sheet={leaveSheet} isChannel={isChannel} groupName={group?.name ?? ""} />
    </>
  )
}

const memberKeyExtractor = (item: GroupMemberDTO) => item.user.id

const useStyles = makeThemedStyles((t) => ({
  list: {
    flex: 1,
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
  kindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    paddingHorizontal: t.space["2"],
    paddingVertical: 3,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  kindBadgeText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textMuted,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  visibilityText: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  visibilityEdit: {
    gap: 6,
    marginBottom: t.space["1"],
  },
  visibilityEditLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textMuted,
  },
  visibilitySegment: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  visibilityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  visibilityOptionActive: {
    borderColor: t.colors.brand.moss,
    backgroundColor: t.colors.moss["50"],
  },
  visibilityOptionText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  visibilityOptionTextActive: {
    color: t.colors.text,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    paddingVertical: t.space["1"],
  },
  sectionLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: t.space["2"],
    paddingTop: t.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  roleLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: t.colors.textSubtle,
    marginLeft: t.space["2"],
  },
  pressed: {
    opacity: 0.55,
  },
  addCard: {
    height: "80%",
  },
  confirmBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14.5,
    color: t.colors.textMuted,
  },
}))
