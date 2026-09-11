import React, { useCallback, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { OrganizationDTO, OrganizationInviteDTO, OrganizationMemberDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, headingLevel } from "../../../theme"
import { Text, TextLink, iconMap, Icon } from "../../../typography"
import type { IconName } from "../../../typography"
import {
  PrimaryButton,
  SecondaryButton,
  SkeletonGroup,
  SkeletonList,
  useToast,
} from "../../../primitives"
import { useAuthState } from "../../../data"
import {
  organizationMemberRows,
  useOrganizationInvites,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useRevokeOrganizationInvite,
  useSetOrganizationMemberRole,
} from "../../../data/hooks/orgs"
import { useLocale, useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { FeedNotice } from "../../FeedNotice"
import { RoleChip } from "../../RoleChip"
import { RosterRow, type RosterRowMenu } from "../../RosterRow"
import { appErrorCode } from "../../errorCode"
import { teamDateLabel } from "../hostTeamModel"
import { OrgInviteSheet } from "./OrgInviteSheet"
import {
  canManageOrgTeam,
  canSeatOrgMembers,
  collaboratorErrorKey,
  orderedOrgMembers,
  orgInviteQuotaReached,
  orgMemberActions,
  orgMemberHasActions,
  pendingOrgInvites,
  type OrgSettableRole,
} from "./dashboardModel"

function CollaboratorRow({
  member,
  viewerId,
  canManage,
  canSeat,
  pending,
  onOpenPerson,
  onSetRole,
  onRemove,
}: {
  member: OrganizationMemberDTO
  viewerId: string | null
  canManage: boolean
  canSeat: boolean
  pending: boolean
  onOpenPerson: (navId: string) => void
  onSetRole: (userId: string, role: OrgSettableRole) => void
  onRemove: (userId: string) => void
}) {
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const actions = orgMemberActions({ member, viewerId, canManage, canSeat })
  const person = member.person

  const menu: RosterRowMenu | null = orgMemberHasActions(actions)
    ? {
        a11yLabel: t("team.actions_a11y", { name: person.name }),
        buildItems: (goToConfirm) => [
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
                  onPress: () => goToConfirm("confirm-remove"),
                },
              ]
            : []),
        ],
        confirmSteps: {
          "confirm-remove": [
            { key: "cancel", label: t("common:cancel"), onPress: () => {} },
            {
              key: "confirm-remove",
              label: t("team.remove_confirm"),
              icon: "UserMinus",
              destructive: true,
              disabled: pending,
              onPress: () => onRemove(person.id),
            },
          ],
        },
      }
    : null

  return (
    <RosterRow
      person={person}
      onOpenPerson={onOpenPerson}
      openA11yLabel={t("team.open_person_a11y", { name: person.name })}
      nameSuffix={
        <RoleChip
          label={tEnums(`organizationMemberRole.${member.role}`)}
          tone={member.role === "owner" ? "lead" : "neutral"}
        />
      }
      menu={menu}
    />
  )
}

function PendingInviteRow({
  invite,
  locale,
  pending,
  onRevoke,
}: {
  invite: OrganizationInviteDTO
  locale: string
  pending: boolean
  onRevoke: (inviteId: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const name = invite.user?.name ?? invite.email ?? t("team.invite_unknown")
  const expires = teamDateLabel(invite.expiresAt, locale)
  return (
    <View style={styles.inviteRow}>
      <View style={styles.inviteMeta}>
        <View style={styles.inviteNameLine}>
          <Text style={styles.inviteName} numberOfLines={1}>
            {name}
          </Text>
          <RoleChip label={tEnums(`organizationMemberRole.${invite.role}`)} />
        </View>
        {expires ? (
          <Text style={styles.inviteSub} numberOfLines={1}>
            {t("team.invite_expires", { when: expires })}
          </Text>
        ) : null}
      </View>
      <SecondaryButton
        label={t("team.revoke")}
        size="sm"
        disabled={pending}
        onPress={() => onRevoke(invite.id)}
      />
    </View>
  )
}

export interface CollaboratorsSectionProps {
  org: OrganizationDTO
}

export function CollaboratorsSection({ org }: CollaboratorsSectionProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { locale } = useLocale()
  const toast = useToast()

  const canManage = canManageOrgTeam(org.myRole)
  const canSeat = canSeatOrgMembers(org.myRole)
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

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Icon icon={iconMap.Users} size={17} color={th.colors.textMuted} />
          <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>
            {t("team.section")}
          </Text>
        </View>
        <PrimaryButton
          label={t("team.invite")}
          icon={iconMap.UserPlus}
          variant="outline"
          disabled={quotaReached}
          onPress={() => setInviteOpen(true)}
        />
      </View>

      {membersQuery.isError ? (
        <FeedNotice
          icon="CloudOff"
          title={t("team.error_title")}
          body={t("team.error_body")}
          actionLabel={t("team.retry")}
          onAction={() => void membersQuery.refetch()}
        />
      ) : null}

      {membersQuery.isPending ? (
        <SkeletonGroup>
          <SkeletonList kind="person" rows={3} />
        </SkeletonGroup>
      ) : null}

      {!membersQuery.isPending && !membersQuery.isError && members.length === 0 ? (
        <Text style={styles.empty}>{t("team.empty")}</Text>
      ) : null}

      {members.map((member) => (
        <CollaboratorRow
          key={member.person.id}
          member={member}
          viewerId={viewerId}
          canManage={canManage}
          canSeat={canSeat}
          pending={managePending}
          onOpenPerson={onOpenPerson}
          onSetRole={onSetRole}
          onRemove={onRemove}
        />
      ))}

      {membersQuery.hasNextPage ? (
        <TextLink
          variant="label"
          standalone
          accessibilityLabel={t("team.show_more_a11y")}
          onPress={() => {
            void membersQuery.fetchNextPage()
          }}
        >
          {membersQuery.isFetchingNextPage ? t("team.loading_more") : t("team.show_more")}
        </TextLink>
      ) : null}

      {invitesQuery.isError ? (
        <Text style={styles.empty}>{t("team.invites_error")}</Text>
      ) : null}

      {invites.length > 0 ? (
        <View style={styles.invites}>
          <Text style={styles.subhead}>{t("team.pending_invites")}</Text>
          {invites.map((invite) => (
            <PendingInviteRow
              key={invite.id}
              invite={invite}
              locale={locale}
              pending={revokeInvite.isPending}
              onRevoke={onRevoke}
            />
          ))}
        </View>
      ) : null}

      {quotaReached ? <Text style={styles.empty}>{t("team.invite_quota")}</Text> : null}

      <OrgInviteSheet visible={inviteOpen} orgId={org.id} onClose={() => setInviteOpen(false)} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  section: {
    gap: t.space["2"],
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["3"],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  subhead: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  empty: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  invites: {
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  inviteMeta: {
    flex: 1,
    minWidth: 0,
  },
  inviteNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  inviteName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  inviteSub: {
    marginTop: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
