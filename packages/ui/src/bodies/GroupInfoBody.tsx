import React, { memo, useCallback, useMemo, useState } from "react"
import { View, Pressable, Image, Modal, StyleSheet } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import type { GroupMemberDTO, GroupRole, PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps, headingLevel, webScrimProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import {
  EmptyState,
  LoadingState,
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
  queryKeys,
} from "../data"
import { useNavStore } from "../nav"
import { useScrollHost, ScrollHostProvider, PLAIN_SCROLL_HOST } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { MemberPicker } from "./MemberPicker"
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

export function GroupInfoBody({ id, onBack, onOpenPerson: onOpenPersonProp }: GroupInfoBodyProps) {
  const { FlatList } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("group-info")
  const qc = useQueryClient()

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
  const addMembers = useAddGroupMembers()
  const updateGroup = useUpdateGroup()
  const removeMember = useRemoveGroupMember()
  const setRole = useSetGroupMemberRole()

  const [addOpen, setAddOpen] = useState(false)
  const [addSelected, setAddSelected] = useState<PersonDTO[]>([])
  const [addError, setAddError] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editVisibility, setEditVisibility] = useState<"private" | "public">("private")
  const [editError, setEditError] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveError, setLeaveError] = useState(false)

  const avatar = useComposerAttachments(1)
  const picked = avatar.attachments[0] ?? null

  const onToggleMute = useCallback(() => {
    toggleMute.mutate(
      { muted: !(group?.muted ?? false) },
      {
        onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.groupInfo(id) }),
      },
    )
  }, [toggleMute, group?.muted, qc, id])

  const openAdd = useCallback(() => {
    setAddSelected([])
    setAddError(false)
    setAddOpen(true)
  }, [])
  const onAddConfirm = useCallback(() => {
    if (addSelected.length === 0 || addMembers.isPending) return
    setAddError(false)
    addMembers.mutate(
      { id, memberIds: addSelected.map((p) => p.id) },
      {
        onSuccess: () => setAddOpen(false),
        onError: () => setAddError(true),
      },
    )
  }, [addSelected, addMembers, id])
  const addExcludeIds = useMemo(() => {
    const ids = (members.data?.pages ?? []).flatMap((p) => p.members.map((m) => m.user.id))
    if (viewerId && !ids.includes(viewerId)) ids.push(viewerId)
    return ids
  }, [members.data, viewerId])

  const openEdit = useCallback(() => {
    setEditName(group?.name ?? "")
    setEditDescription(group?.description ?? "")
    setEditVisibility(group?.visibility ?? "private")
    setEditError(false)
    if (picked) avatar.removeAttachment(picked.id)
    setEditOpen(true)
  }, [group?.name, group?.description, group?.visibility, picked, avatar])
  const editValid = canCreateGroup(editName, editDescription)
  const onEditSave = useCallback(() => {
    if (!editValid || avatar.uploading || updateGroup.isPending) return
    setEditError(false)
    const draft = normalizeGroupDraft(editName, editDescription)
    updateGroup.mutate(
      {
        id,
        name: draft.name,
        description: draft.description ?? "",
        ...(isOwner && editVisibility !== group?.visibility ? { visibility: editVisibility } : {}),
        ...(picked?.uploadId ? { avatarUploadId: picked.uploadId } : {}),
      },
      {
        onSuccess: () => {
          if (picked) avatar.removeAttachment(picked.id)
          setEditOpen(false)
        },
        onError: () => setEditError(true),
      },
    )
  }, [editValid, avatar, updateGroup, id, editName, editDescription, editVisibility, isOwner, group?.visibility, picked])

  const onLeaveConfirm = useCallback(() => {
    if (!viewerId || removeMember.isPending) return
    setLeaveError(false)
    removeMember.mutate(
      { id, userId: viewerId },
      {
        onSuccess: () => {
          setLeaveOpen(false)
          if (onBack) onBack()
          else useNavStore.getState().setStack([{ kind: "messages" }])
        },
        onError: () => setLeaveError(true),
      },
    )
  }, [viewerId, removeMember, id, onBack])

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
      .setString(`/messages/group/${id}`)
      .then(() => toast.show(t("link_copied"), { variant: "success" }))
      .catch(() => {})
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
      <View style={styles.hero}>
        <View style={[styles.heroAvatar, group?.avatar?.url ? styles.heroAvatarFramed : null]}>
          {group?.avatar?.url ? (
            <Image source={{ uri: group.avatar.url }} style={styles.heroAvatarImage} resizeMode="cover" />
          ) : (
            <Icon icon={iconMap.Users} size={34} color={th.colors.onAccent} />
          )}
        </View>
        <Text style={styles.heroName} numberOfLines={2} accessibilityRole="header" {...headingLevel(2)}>
          {group?.name ?? ""}
        </Text>
        {group?.kind === "channel" ? (
          <View style={styles.kindBadge}>
            <Icon icon={iconMap.Megaphone} size={12} color={th.colors.textMuted} />
            <Text style={styles.kindBadgeText}>{t("kind_channel")}</Text>
          </View>
        ) : null}
        {group?.description ? (
          <Text style={styles.heroDescription}>{group.description}</Text>
        ) : null}
        <Text style={styles.heroMembers}>
          {isChannel ? t("subscribers", { count: memberCount }) : t("members", { count: memberCount })}
        </Text>
        {isOwner && group ? (
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
        ) : null}
      </View>

      <View style={styles.actions}>
        <ActionRow
          icon={group?.muted ? "BellOff" : "Bell"}
          label={group?.muted ? t("unmute") : t("mute")}
          disabled={toggleMute.isPending || !group}
          onPress={onToggleMute}
        />
        {canManage ? <ActionRow icon="UserPlus" label={isChannel ? t("add_subscribers") : t("add_members")} onPress={openAdd} /> : null}
        {canManage ? <ActionRow icon="Pencil" label={t("edit_info")} onPress={openEdit} /> : null}
        {isChannel && isPublic && clipboard ? (
          <ActionRow icon="Link2" label={t("copy_link")} onPress={onCopyLink} />
        ) : null}
        {viewerRole === "admin" || viewerRole === "member" ? (
          <ActionRow
            icon="LogOut"
            label={isChannel ? t("leave_channel") : t("leave")}
            destructive
            onPress={() => { setLeaveError(false); setLeaveOpen(true) }}
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

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t("sheet_dismiss")}
            onPress={() => setAddOpen(false)}
            {...webScrimProps}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={[styles.card, styles.addCard]}>
              <Text variant="bodyStrong" color={th.colors.text}>
                {t("add_members")}
              </Text>
              <View style={styles.pickerFill}>
                <ScrollHostProvider value={PLAIN_SCROLL_HOST}>
                  <MemberPicker selected={addSelected} onChange={setAddSelected} excludeIds={addExcludeIds} />
                </ScrollHostProvider>
              </View>
              {addError ? <Text style={styles.errorText}>{t("add_error")}</Text> : null}
              <View style={styles.cardActions}>
                <SecondaryButton label={t("cancel")} onPress={() => setAddOpen(false)} size="sm" />
                <PrimaryButton
                  label={t("add")}
                  onPress={onAddConfirm}
                  loading={addMembers.isPending}
                  disabled={addSelected.length === 0 || addMembers.isPending}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t("sheet_dismiss")}
            onPress={() => setEditOpen(false)}
            {...webScrimProps}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.card}>
              <Text variant="bodyStrong" color={th.colors.text}>
                {t("edit_info")}
              </Text>
              <GroupIdentityFields
                variant="sheet"
                avatar={avatar}
                name={editName}
                onChangeName={setEditName}
                description={editDescription}
                onChangeDescription={setEditDescription}
                fallbackAvatarUrl={group?.avatar?.url ?? null}
                labels={{
                  avatarA11y: t("avatar_a11y"),
                  nameLabel: t("name_label"),
                  namePlaceholder: t("name_placeholder"),
                  descriptionLabel: t("description_label"),
                  descriptionPlaceholder: t("description_placeholder"),
                }}
              />
              {isOwner ? (
                <View style={styles.visibilityEdit}>
                  <Text style={styles.visibilityEditLabel}>{t("visibility_label")}</Text>
                  <View style={styles.visibilitySegment}>
                    {(["private", "public"] as const).map((v) => {
                      const active = editVisibility === v
                      return (
                        <Pressable
                          key={v}
                          onPress={() => setEditVisibility(v)}
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
              {editError ? <Text style={styles.errorText}>{t("edit_error")}</Text> : null}
              <View style={styles.cardActions}>
                <SecondaryButton label={t("cancel")} onPress={() => setEditOpen(false)} size="sm" />
                <PrimaryButton
                  label={t("save")}
                  onPress={onEditSave}
                  loading={updateGroup.isPending}
                  disabled={!editValid || avatar.uploading || updateGroup.isPending}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={leaveOpen} transparent animationType="fade" onRequestClose={() => setLeaveOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t("sheet_dismiss")}
            onPress={() => setLeaveOpen(false)}
            {...webScrimProps}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.card}>
              <Text variant="bodyStrong" color={th.colors.text}>
                {isChannel ? t("leave_channel") : t("leave")}
              </Text>
              <Text style={styles.confirmBody}>{t("leave_confirm", { name: group?.name ?? "" })}</Text>
              {leaveError ? <Text style={styles.errorText}>{t("leave_error")}</Text> : null}
              <View style={styles.cardActions}>
                <SecondaryButton label={t("cancel")} onPress={() => setLeaveOpen(false)} size="sm" />
                <PrimaryButton
                  label={t("leave_action")}
                  onPress={onLeaveConfirm}
                  loading={removeMember.isPending}
                  disabled={removeMember.isPending}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  kindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  heroDescription: {
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
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  visibilityText: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 12,
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
    fontSize: 13,
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
  },
  rowPressed: {
    opacity: 0.7,
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
    maxHeight: "100%",
    gap: t.space["3"],
    padding: t.space["4"],
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  addCard: {
    height: "80%",
  },
  pickerFill: {
    flex: 1,
    minHeight: 0,
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
  errorText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.bloom["600"],
    textAlign: "center",
  },
}))
