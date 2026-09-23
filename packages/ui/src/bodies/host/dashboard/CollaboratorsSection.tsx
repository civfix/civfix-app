import React, { useCallback, useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import type { OrganizationDTO, OrganizationInviteDTO, OrganizationMemberDTO } from "@civfix/shared"
import { DELETED_USER_LABEL } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webHover,
  webTransition,
} from "../../../theme"
import { Text, TextLink, Icon, iconMap } from "../../../typography"
import type { IconName } from "../../../typography"
import {
  Avatar,
  IconTile,
  LIST_DIVIDER_INSET,
  LIST_TILE,
  ListRow,
  PopoverMenu,
  SectionCard,
  useToast,
  usePopoverAnchor,
} from "../../../primitives"
import type { AnchorRect, PopoverMenuItem } from "../../../primitives"
import { useAuthState } from "../../../data"
import {
  organizationMemberRows,
  useOrganizationInvites,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useRevokeOrganizationInvite,
  useSetOrganizationMemberRole,
} from "../../../data/hooks/orgs"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { FeedNotice } from "../../FeedNotice"
import { RowsSkeleton } from "../HostSkeletons"
import { appErrorCode } from "../../errorCode"
import { lastAdminSeat } from "../orgManageModel"
import { OrgInviteSheet } from "./OrgInviteSheet"
import {
  canManageOrgTeam,
  canSetOrgMemberRole,
  collaboratorErrorKey,
  orderedOrgMembers,
  orgInviteQuotaReached,
  orgMemberActions,
  orgMemberHasActions,
  pendingOrgInvites,
  type OrgSettableRole,
} from "./dashboardModel"

const CLOSED = "closed"

const ACTIONS = "actions"

const CONFIRM_REMOVE = "confirm-remove"

const KEBAB_SIZE = 32

const KEBAB_HIT_SLOP = 6

const MORE_ROW_HEIGHT = 44

function MemberRow({
  member,
  viewerId,
  canManage,
  canSetRole,
  lastAdmin,
  pending,
  onOpenPerson,
  onSetRole,
  onRemove,
}: {
  member: OrganizationMemberDTO
  viewerId: string | null
  canManage: boolean
  canSetRole: boolean
  lastAdmin: boolean
  pending: boolean
  onOpenPerson: (navId: string) => void
  onSetRole: (userId: string, role: OrgSettableRole) => void
  onRemove: (userId: string) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const [menuStep, setMenuStep] = useState<string>(CLOSED)
  const [menuRect, setMenuRect] = useState<AnchorRect | null>(null)
  const { ref: menuAnchorRef, measure: measureMenu } = usePopoverAnchor(setMenuRect)
  const actions = orgMemberActions({ member, viewerId, canManage, canSetRole, lastAdmin })
  const person = member.person
  const roleLabel = tEnums(`organizationMemberRole.${member.role}`)

  if (person.deleted) {
    return (
      <ListRow
        leading={<Avatar name={DELETED_USER_LABEL} seed={person.id} size={LIST_TILE} />}
        title={DELETED_USER_LABEL}
        titleLines={1}
        sub={roleLabel}
      />
    )
  }

  const items: PopoverMenuItem[] = [
    ...actions.roles.map((role) => ({
      key: `role-${role}`,
      label: t("team.make_role", { role: tEnums(`organizationMemberRole.${role}`) }),
      icon: (role === "member" ? "UserMinus" : "UserPlus") as IconName,
      disabled: pending,
      onPress: () => onSetRole(person.id, role),
    })),
    ...(actions.canRemove
      ? [
          {
            key: "remove",
            label: t("team.remove"),
            icon: "UserMinus" as const,
            destructive: true,
            onPress: () => setMenuStep(CONFIRM_REMOVE),
          },
        ]
      : []),
  ]
  const hasKebab = orgMemberHasActions(actions) && items.length > 0

  return (
    <>
      <ListRow
        leading={
          <Avatar
            name={person.name}
            seed={person.id}
            photoUrl={person.avatarUrl}
            gradient={person.avatar ?? null}
            size={LIST_TILE}
          />
        }
        title={person.name}
        titleLines={1}
        sub={roleLabel}
        accessibilityLabel={t("team.open_person_a11y", { name: person.name })}
        onPress={() => onOpenPerson(person.handle ?? person.id)}
        trailing={
          hasKebab ? (
            <Pressable
              ref={menuAnchorRef}
              onPress={() => {
                measureMenu()
                setMenuStep(ACTIONS)
              }}
              accessibilityRole="button"
              accessibilityLabel={t("team.actions_a11y", { name: person.name })}
              accessibilityState={{ expanded: menuStep !== CLOSED }}
              hitSlop={KEBAB_HIT_SLOP}
              {...focusRingProps}
              style={(state) => [
                styles.kebab,
                webTransition,
                webCursorPointer,
                webHover(state) ? styles.kebabHovered : null,
                state.pressed ? styles.kebabPressed : null,
              ]}
            >
              <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.textSubtle} />
            </Pressable>
          ) : null
        }
      />
      {hasKebab ? (
        <>
          <PopoverMenu
            visible={menuStep === ACTIONS}
            anchorRect={menuRect}
            onClose={() => setMenuStep(CLOSED)}
            items={items}
          />
          <PopoverMenu
            visible={menuStep === CONFIRM_REMOVE}
            anchorRect={menuRect}
            onClose={() => setMenuStep(CLOSED)}
            items={[
              { key: "cancel", label: t("common:cancel"), onPress: () => setMenuStep(CLOSED) },
              {
                key: CONFIRM_REMOVE,
                label: t("team.remove_confirm"),
                icon: "UserMinus",
                destructive: true,
                disabled: pending,
                onPress: () => {
                  setMenuStep(CLOSED)
                  onRemove(person.id)
                },
              },
            ]}
          />
        </>
      ) : null}
    </>
  )
}

function PendingInviteRow({
  invite,
  pending,
  onRevoke,
}: {
  invite: OrganizationInviteDTO
  pending: boolean
  onRevoke: (inviteId: string) => void
}) {
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const name =
    invite.user?.handle ?? invite.user?.name ?? invite.email ?? t("team.invite_unknown")
  return (
    <ListRow
      leading={<IconTile icon="Mail" tone="attention" />}
      title={name}
      titleLines={1}
      sub={t("team.invite_row_sub", {
        role: tEnums(`organizationMemberRole.${invite.role}`),
      })}
      trailing={
        <TextLink
          variant="label"
          standalone
          disabled={pending}
          accessibilityLabel={t("team.revoke")}
          onPress={() => onRevoke(invite.id)}
        >
          {t("team.revoke")}
        </TextLink>
      }
    />
  )
}

export interface CollaboratorsSectionProps {
  org: OrganizationDTO
}

export function CollaboratorsSection({ org }: CollaboratorsSectionProps) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const toast = useToast()

  const canManage = canManageOrgTeam(org.myRole)
  const canSetRole = canSetOrgMemberRole(org.myRole)
  const viewerId = useAuthState().user?.id ?? null

  const membersQuery = useOrganizationMembers(org.id, { enabled: canManage })
  const invitesQuery = useOrganizationInvites(org.id, { enabled: canManage })
  const setRole = useSetOrganizationMemberRole(org.id)
  const removeMember = useRemoveOrganizationMember(org.id)
  const revokeInvite = useRevokeOrganizationInvite(org.id)

  const [inviteOpen, setInviteOpen] = useState(false)

  const members = useMemo(
    () => orderedOrgMembers(organizationMemberRows(membersQuery.data?.pages)),
    [membersQuery.data],
  )
  const invites = useMemo(() => pendingOrgInvites(invitesQuery.data ?? []), [invitesQuery.data])
  const lastAdmin = !membersQuery.hasNextPage && lastAdminSeat(members)
  const quotaReached = orgInviteQuotaReached(invitesQuery.data ?? [])
  const managePending = setRole.isPending || removeMember.isPending

  const onError = useCallback(
    (err: unknown) => {
      toast.show(t(collaboratorErrorKey(appErrorCode(err))), { variant: "error" })
    },
    [t, toast],
  )

  const onOpenPerson = useCallback((navId: string) => {
    useNavStore.getState().push({ kind: "person", id: navId })
  }, [])

  const onSetRole = useCallback(
    (userId: string, role: OrgSettableRole) => {
      setRole.mutate({ userId, role }, { onError })
    },
    [onError, setRole],
  )

  const onRemove = useCallback(
    (userId: string) => {
      removeMember.mutate({ userId }, { onError })
    },
    [onError, removeMember],
  )

  const onRevoke = useCallback(
    (inviteId: string) => {
      revokeInvite.mutate(
        { inviteId },
        {
          onSuccess: () => toast.show(t("team.invite_revoked"), { variant: "success" }),
          onError,
        },
      )
    },
    [onError, revokeInvite, t, toast],
  )

  if (!canManage) return null

  if (membersQuery.isPending) return <RowsSkeleton rows={3} />

  const invite = (
    <TextLink
      variant="label"
      standalone
      disabled={quotaReached}
      accessibilityLabel={t("team.invite")}
      onPress={() => setInviteOpen(true)}
    >
      {t("team.invite")}
    </TextLink>
  )

  if (membersQuery.isError) {
    return (
      <SectionCard label={t("team.section")} trailing={invite}>
        <FeedNotice
          icon="CloudOff"
          title={t("team.error_title")}
          body={t("team.error_body")}
          actionLabel={t("team.retry")}
          onAction={() => void membersQuery.refetch()}
        />
        <OrgInviteSheet visible={inviteOpen} orgId={org.id} onClose={() => setInviteOpen(false)} />
      </SectionCard>
    )
  }

  const notes = invitesQuery.isError ? [t("team.invites_error")] : []

  return (
    <View>
      <SectionCard
        label={t("team.section")}
        trailing={invite}
        variant="list"
        dividerInset={LIST_DIVIDER_INSET}
        listHeader={
          quotaReached ? (
            <View style={styles.noteRow}>
              <Text variant="caption">{t("team.invite_quota")}</Text>
            </View>
          ) : undefined
        }
      >
        {members.length === 0 && invites.length === 0 ? (
          <View style={styles.noteRow}>
            <Text variant="label">{t("team.empty")}</Text>
          </View>
        ) : null}
        {members.map((member) => (
          <MemberRow
            key={member.person.id}
            member={member}
            viewerId={viewerId}
            canManage={canManage}
            canSetRole={canSetRole}
            lastAdmin={lastAdmin}
            pending={managePending}
            onOpenPerson={onOpenPerson}
            onSetRole={onSetRole}
            onRemove={onRemove}
          />
        ))}
        {invites.map((row) => (
          <PendingInviteRow
            key={row.id}
            invite={row}
            pending={revokeInvite.isPending}
            onRevoke={onRevoke}
          />
        ))}
        {membersQuery.hasNextPage ? (
          <View style={styles.moreRow}>
            <TextLink
              variant="label"
              standalone
              accessibilityLabel={t("team.show_more_a11y")}
              disabled={membersQuery.isFetchingNextPage}
              onPress={() => {
                if (!membersQuery.isFetchingNextPage) void membersQuery.fetchNextPage()
              }}
            >
              {membersQuery.isFetchingNextPage ? t("team.loading_more") : t("team.show_more")}
            </TextLink>
          </View>
        ) : null}
        {notes.length > 0 ? (
          <View style={styles.noteRow}>
            {notes.map((note) => (
              <Text key={note} variant="caption">
                {note}
              </Text>
            ))}
          </View>
        ) : null}
      </SectionCard>

      <OrgInviteSheet visible={inviteOpen} orgId={org.id} onClose={() => setInviteOpen(false)} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  kebab: {
    width: KEBAB_SIZE,
    height: KEBAB_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  kebabHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  kebabPressed: {
    opacity: 0.92,
  },
  noteRow: {
    gap: t.space["1"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
  },
  moreRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: MORE_ROW_HEIGHT,
    paddingHorizontal: t.space["4"],
  },
}))
