import React, { useCallback, useState } from "react"
import { View } from "react-native"
import { TextInput } from "../../../primitives/TextInput"
import type { OrgInviteIdentifierKind } from "@civfix/shared"
import {
  makeThemedStyles,
  useTheme,
  webInputReset,
} from "../../../theme"
import { Text } from "../../../typography"
import {
  FilterChip,
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  modalSheetInputFocusedStyle,
  modalSheetInputStyle,
  useToast,
} from "../../../primitives"
import { useT } from "../../../i18n"
import { useInviteOrganizationMember } from "../../../data/hooks/orgs"
import { appErrorCode } from "../../errorCode"
import { INVITE_IDENTIFIER_MAX, inviteIdentifierValue } from "../hostTeamModel"
import {
  ORG_SETTABLE_ROLES,
  orgInviteErrorKey,
  orgInviteIdentifierErrorKey,
  type OrgSettableRole,
} from "./dashboardModel"

const IDENTIFIER_KINDS: readonly OrgInviteIdentifierKind[] = ["handle", "email"]

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
  const toast = useToast()
  const invite = useInviteOrganizationMember(orgId)

  const [identifierKind, setIdentifierKind] = useState<OrgInviteIdentifierKind>("handle")
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<OrgSettableRole>("member")
  const [focused, setFocused] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const onClosed = useCallback(() => {
    setIdentifierKind("handle")
    setIdentifier("")
    setRole("member")
    setErrorText(null)
    setFocused(false)
    if (!invite.isPending) invite.reset()
  }, [invite])

  const value = inviteIdentifierValue(identifierKind, identifier)
  const canSubmit = value !== null && !invite.isPending

  const onPickKind = useCallback((kind: OrgInviteIdentifierKind) => {
    setIdentifierKind(kind)
    setIdentifier("")
    setErrorText(null)
  }, [])

  const submit = useCallback(() => {
    if (invite.isPending) return
    if (value === null) {
      setErrorText(t(orgInviteIdentifierErrorKey(identifierKind)))
      return
    }
    setErrorText(null)
    invite.mutate(
      { identifierKind, identifier: value, role },
      {
        onSuccess: () => {
          toast.show(t("team.invite_sent"), { variant: "success" })
          onClose()
        },
        onError: (err) => setErrorText(t(orgInviteErrorKey(appErrorCode(err)))),
      },
    )
  }, [identifierKind, invite, onClose, role, t, toast, value])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      onCommit={submit}
      headerIcon="UserPlus"
      headerIconColor={th.colors.moss["700"]}
      title={t("team.invite_title")}
      dismissLabel={t("team.invite_dismiss_a11y")}
      backdropDismissDisabled={invite.isPending}
      error={errorText}
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
            onPress={submit}
            loading={invite.isPending}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <Text variant="label">{t("team.invite_identifier_kind")}</Text>
      <SegmentedControl
        label={t("team.invite_identifier_kind")}
        selected={identifierKind}
        onSelect={(key) => onPickKind(key as OrgInviteIdentifierKind)}
        options={IDENTIFIER_KINDS.map((kind) => ({
          key: kind,
          label: kind === "email" ? t("team.by_email") : t("team.by_handle"),
        }))}
        disabled={invite.isPending}
      />

      <Text variant="label">
        {identifierKind === "email" ? t("team.email") : t("team.handle")}
      </Text>
      <TextInput
        value={identifier}
        onChangeText={(next) => setIdentifier(next.slice(0, INVITE_IDENTIFIER_MAX))}
        editable={!invite.isPending}
        maxLength={INVITE_IDENTIFIER_MAX}
        accessibilityLabel={identifierKind === "email" ? t("team.email") : t("team.handle")}
        placeholderTextColor={th.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={identifierKind === "email" ? "email-address" : "default"}
        textContentType={identifierKind === "email" ? "emailAddress" : "username"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? modalSheetInputFocusedStyle(th) : null]}
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
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 42,
  },
  roles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
}))
