import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Text } from "../../../typography"
import { FilterChip, ModalCardSheet, PrimaryButton, SecondaryButton } from "../../../primitives"
import { useT } from "../../../i18n"
import { useInviteOrganizationMember } from "../../../data/hooks/orgs"
import { InviteIdentifierFields } from "../InviteIdentifierFields"
import { useInviteForm } from "../useInviteForm"
import {
  ORG_SETTABLE_ROLES,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  type OrgSettableRole,
} from "./dashboardModel"

const DEFAULT_INVITE_ROLE: OrgSettableRole = "member"

export interface OrgInviteSheetProps {
  visible: boolean
  orgId: string
  onClose: () => void
}

export function OrgInviteSheet({ visible, orgId, onClose }: OrgInviteSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  const { t: tEnums } = useT("enums")
  const invite = useInviteOrganizationMember(orgId)
  const form = useInviteForm<OrgSettableRole>({
    invite,
    defaultRole: DEFAULT_INVITE_ROLE,
    t,
    identifierErrorKey: orgInviteIdentifierErrorKey,
    errorKey: orgInviteErrorKey,
    sentMessage: () => t("team.invite_sent"),
    onClose,
  })
  const { role, setRole } = form

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onClosed={form.onClosed}
      onCommit={form.submit}
      headerIcon="UserPlus"
      headerIconColor={th.colors.moss["700"]}
      title={t("team.invite_title")}
      dismissLabel={t("team.invite_dismiss_a11y")}
      backdropDismissDisabled={invite.isPending}
      error={form.errorText}
      actions={
        <>
          <SecondaryButton
            label={t("common:cancel")}
            onPress={onClose}
            size="sm"
            disabled={invite.isPending}
          />
          <PrimaryButton
            label={t("team.invite_send")}
            onPress={form.submit}
            loading={invite.isPending}
            disabled={!form.canSubmit}
          />
        </>
      }
    >
      <InviteIdentifierFields
        labels={{
          kind: t("team.invite_identifier_kind"),
          byEmail: t("team.by_email"),
          byHandle: t("team.by_handle"),
          email: t("team.email"),
          handle: t("team.handle"),
        }}
        identifierKind={form.identifierKind}
        identifier={form.identifier}
        onPickKind={form.onPickKind}
        focused={form.identifierFocused}
        onFocusChange={form.setIdentifierFocused}
        onChangeIdentifier={form.setIdentifier}
        disabled={invite.isPending}
      />

      <Text variant="label">{t("team.invite_role")}</Text>
      <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabel={t("team.invite_role")}>
        {ORG_SETTABLE_ROLES.map((option) => (
          <FilterChip
            key={option}
            label={tEnums(`organizationMemberRole.${option}`)}
            selected={option === role}
            onPress={() => setRole(option)}
          />
        ))}
      </View>
      <Text variant="caption">{t(`team.role_hint_${role}`)}</Text>

      <Text variant="caption" color={th.colors.textSubtle}>
        {t("team.invite_privacy_note")}
      </Text>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  roles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
}))
