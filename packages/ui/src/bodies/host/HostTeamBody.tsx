import React, { memo, useCallback, useMemo, useState } from "react"
import { View, StyleSheet } from "react-native"
import type { EventTeamInviteDTO, EventTeamMemberDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, headingLevel } from "../../theme"
import { Text, iconMap } from "../../typography"
import type { IconName } from "../../typography"
import {
  LoadingState,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  useToast,
} from "../../primitives"
import { useAuthState, useCleanup, useRemoveMember, useSetMemberRole } from "../../data"
import {
  cleanupHostStanding,
  hasHostCapability,
  useHostTeam,
  useRevokeEventTeamInvite,
} from "../../data/hooks/host"
import { useLocale, useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { RoleChip } from "../RoleChip"
import { RosterRow, type RosterRowMenu } from "../RosterRow"
import { appErrorCode } from "../../data/errorCode"
import { type SettableEventMemberRole } from "../../data/eventTeamTiers"
import { HostStateNotice } from "./HostStateNotice"
import { HostTeamInviteSheet } from "./HostTeamInviteSheet"
import {
  inviteDisplayName,
  inviteQuotaReached,
  orderedTeamInvites,
  orderedTeamMembers,
  teamDateLabel,
  teamManageErrorKey,
  teamMemberActions,
  teamMemberHasActions,
} from "./hostTeamModel"

const TeamMemberRow = memo(function TeamMemberRow({
  member,
  viewerId,
  canManageTeam,
  managePending,
  locale,
  onOpenPerson,
  onSetRole,
  onRemove,
}: {
  member: EventTeamMemberDTO
  viewerId: string | null
  canManageTeam: boolean
  managePending: boolean
  locale: string
  onOpenPerson: (navId: string) => void
  onSetRole: (userId: string, role: SettableEventMemberRole) => void
  onRemove: (userId: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("host-team")
  const { t: tMembers } = useT("event-members")
  const { t: tEnums } = useT("enums")

  const actions = teamMemberActions({ member, viewerId, canManageTeam })
  const person = member.person

  const menu: RosterRowMenu | null = teamMemberHasActions(actions)
    ? {
        a11yLabel: tMembers("manage.set_role_a11y", { name: person.name }),
        buildItems: (goToConfirm) => [
          ...actions.roles.map((role) => ({
            key: `role-${role}`,
            label: tMembers("manage.make_role", { role: tEnums(`cleanupMemberRole.${role}`) }),
            icon: role === "member" ? ("UserMinus" as IconName) : ("UserPlus" as IconName),
            disabled: managePending,
            onPress: () => onSetRole(person.id, role),
          })),
          ...(actions.canRemove
            ? [
                {
                  key: "remove",
                  label: tMembers("manage.remove"),
                  icon: "UserMinus" as const,
                  destructive: true,
                  onPress: () => goToConfirm("confirm-remove"),
                },
              ]
            : []),
        ],
        confirmSteps: {
          "confirm-remove": [
            { key: "cancel", label: tMembers("manage.removeCancel"), onPress: () => {} },
            {
              key: "confirm-remove",
              label: tMembers("manage.removeConfirm"),
              icon: "UserMinus",
              destructive: true,
              disabled: managePending,
              onPress: () => onRemove(person.id),
            },
          ],
        },
      }
    : null

  const joined = teamDateLabel(member.joinedAt, locale)

  return (
    <RosterRow
      person={person}
      onOpenPerson={onOpenPerson}
      openA11yLabel={tMembers("row.viewProfileA11y", { name: person.name })}
      nameSuffix={
        <RoleChip
          label={tEnums(`cleanupMemberRole.${member.role}`)}
          tone={member.role === "organizer" ? "lead" : "neutral"}
        />
      }
      trailing={
        joined ? (
          <Text style={styles.joined} numberOfLines={1}>
            {t("members.joined", { when: joined })}
          </Text>
        ) : null
      }
      menu={menu}
    />
  )
})

function InviteRow({
  invite,
  locale,
  revokePending,
  onRevoke,
}: {
  invite: EventTeamInviteDTO
  locale: string
  revokePending: boolean
  onRevoke: (inviteId: string) => void
}) {
  const styles = useStyles()
  const { t } = useT("host-team")
  const { t: tEnums } = useT("enums")

  const sent = teamDateLabel(invite.createdAt, locale)
  const expires = teamDateLabel(invite.expiresAt, locale)
  const sub = [
    sent ? t("invites.sent", { when: sent }) : null,
    expires ? t("invites.expires", { when: expires }) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ")

  return (
    <View style={styles.inviteRow}>
      <View style={styles.inviteMeta}>
        <View style={styles.inviteNameLine}>
          <Text style={styles.inviteName} numberOfLines={1}>
            {inviteDisplayName(invite, t("invites.unknown"))}
          </Text>
          <RoleChip label={tEnums(`cleanupMemberRole.${invite.role}`)} />
        </View>
        {sub ? (
          <Text style={styles.inviteSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {invite.status === "pending" ? (
        <SecondaryButton
          label={t("invites.revoke")}
          size="sm"
          disabled={revokePending}
          onPress={() => onRevoke(invite.id)}
        />
      ) : (
        <Text style={styles.inviteStatus}>{t(`invites.status_${invite.status}`)}</Text>
      )}
    </View>
  )
}

export function HostTeamBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-team")
  const { locale } = useLocale()
  const { ScrollView } = useScrollHost()
  const toast = useToast()

  const cleanup = useCleanup(id)
  const viewerId = useAuthState().user?.id ?? null
  const standing = cleanupHostStanding(cleanup.data, viewerId)
  const canManageTeam = hasHostCapability(standing, "manage_team")

  const team = useHostTeam(id, { enabled: canManageTeam })
  const setMemberRole = useSetMemberRole()
  const removeMember = useRemoveMember()
  const revokeInvite = useRevokeEventTeamInvite(id)
  const managePending = setMemberRole.isPending || removeMember.isPending

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null)

  const members = useMemo(() => orderedTeamMembers(team.data?.members ?? []), [team.data])
  const invites = useMemo(() => orderedTeamInvites(team.data?.invites ?? []), [team.data])
  const quotaReached = inviteQuotaReached(team.data?.invites ?? [])

  const onOpenPerson = useCallback((navId: string) => {
    useNavStore.getState().push({ kind: "person", id: navId })
  }, [])

  const onManageError = useCallback(
    (err: unknown) => {
      toast.show(t(teamManageErrorKey(appErrorCode(err))), { variant: "error" })
    },
    [t, toast],
  )

  const onSetRole = useCallback(
    (userId: string, role: SettableEventMemberRole) => {
      setMemberRole.mutate({ id, userId, role }, { onError: onManageError })
    },
    [id, onManageError, setMemberRole],
  )

  const onRemove = useCallback(
    (userId: string) => {
      removeMember.mutate({ id, userId }, { onError: onManageError })
    },
    [id, onManageError, removeMember],
  )

  const onConfirmRevoke = useCallback(() => {
    if (pendingRevoke === null) return
    revokeInvite.mutate(
      { inviteId: pendingRevoke },
      {
        onSuccess: () => {
          setPendingRevoke(null)
          toast.show(t("invite.revoked"), { variant: "success" })
        },
        onError: (err) => {
          setPendingRevoke(null)
          onManageError(err)
        },
      },
    )
  }, [onManageError, pendingRevoke, revokeInvite, t, toast])

  if (cleanup.isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.muted}>{t("state.loading")}</Text>
      </ScrollView>
    )
  }

  if (cleanup.isError || !cleanup.data) {
    return (
      <HostStateNotice icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
    )
  }

  if (!canManageTeam) {
    return (
      <HostStateNotice icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title} numberOfLines={2}>
        {cleanup.data.title}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>
            {t("members.title")}
          </Text>
          <PrimaryButton
            label={t("invite.action")}
            icon={iconMap.UserPlus}
            variant="outline"
            disabled={quotaReached}
            onPress={() => setInviteOpen(true)}
          />
        </View>
        {quotaReached ? <Text style={styles.muted}>{t("invite.limit_reached")}</Text> : null}

        {team.isLoading ? (
          <LoadingState skeleton="person" rows={4} />
        ) : team.isError ? (
          <Text style={styles.muted} accessibilityRole="alert">
            {t("state.error_body")}
          </Text>
        ) : members.length === 0 ? (
          <Text style={styles.muted}>{t("members.empty_body")}</Text>
        ) : (
          members.map((member) => (
            <TeamMemberRow
              key={member.person.id}
              member={member}
              viewerId={viewerId}
              canManageTeam={canManageTeam}
              managePending={managePending}
              locale={locale}
              onOpenPerson={onOpenPerson}
              onSetRole={onSetRole}
              onRemove={onRemove}
            />
          ))
        )}
      </View>

      {invites.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>
            {t("invites.title")}
          </Text>
          {invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              locale={locale}
              revokePending={revokeInvite.isPending && pendingRevoke === invite.id}
              onRevoke={setPendingRevoke}
            />
          ))}
        </View>
      ) : null}

      <HostTeamInviteSheet
        visible={inviteOpen}
        cleanupId={id}
        onClose={() => setInviteOpen(false)}
      />

      <ModalCardSheet
        visible={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onCommit={onConfirmRevoke}
        headerIcon="Clock"
        headerIconColor={th.colors.bloom["600"]}
        title={t("invites.revoke_title")}
        dismissLabel={t("common:dismiss")}
        backdropDismissDisabled={revokeInvite.isPending}
        actions={
          <>
            <SecondaryButton
              label={t("common:cancel")}
              size="sm"
              disabled={revokeInvite.isPending}
              onPress={() => setPendingRevoke(null)}
            />
            <PrimaryButton
              label={t("invites.revoke")}
              variant="destructive"
              onPress={onConfirmRevoke}
              loading={revokeInvite.isPending}
              disabled={revokeInvite.isPending}
            />
          </>
        }
      >
        <Text style={styles.muted}>{t("invites.revoke_body")}</Text>
      </ModalCardSheet>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["20"],
    color: t.colors.text,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  section: {
    gap: t.space["2"],
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["3"],
  },
  sectionTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingVertical: t.space["3"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  inviteMeta: {
    flex: 1,
    minWidth: 0,
  },
  inviteNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inviteName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  inviteSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  inviteStatus: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  joined: {
    flexShrink: 0,
    maxWidth: 120,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
