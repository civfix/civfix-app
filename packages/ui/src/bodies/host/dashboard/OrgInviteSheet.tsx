import React, { useCallback, useEffect, useState } from "react"
import { View, Pressable, TextInput } from "react-native"
import type { OrgInviteIdentifierKind } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
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

  useEffect(() => {
    if (!visible) return
    setIdentifierKind("handle")
    setIdentifier("")
    setRole("member")
    setErrorText(null)
    invite.reset()
  }, [visible])

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
      <View style={styles.segments} accessibilityRole="radiogroup">
        {IDENTIFIER_KINDS.map((kind) => {
          const selected = kind === identifierKind
          const label = kind === "email" ? t("team.by_email") : t("team.by_handle")
          return (
            <Pressable
              key={kind}
              onPress={() => onPickKind(kind)}
              disabled={invite.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: invite.isPending }}
              accessibilityLabel={label}
              {...focusRingProps}
              style={(state) => [
                styles.segment,
                webTransition,
                webCursor(invite.isPending),
                selected ? styles.segmentOn : null,
                !selected && webHover(state) ? styles.segmentHovered : null,
              ]}
            >
              <Icon
                icon={kind === "email" ? iconMap.Mail : iconMap.AtSign}
                size={14}
                color={selected ? th.colors.onAccent : th.colors.textMuted}
              />
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

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
        {ORG_SETTABLE_ROLES.map((option) => {
          const selected = option === role
          return (
            <Pressable
              key={option}
              onPress={() => setRole(option)}
              disabled={invite.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: invite.isPending }}
              accessibilityLabel={tEnums(`organizationMemberRole.${option}`)}
              {...focusRingProps}
              style={(state) => [
                styles.role,
                webTransition,
                webCursor(invite.isPending),
                selected ? styles.roleSelected : null,
                !selected && webHover(state) ? styles.roleHovered : null,
              ]}
            >
              <Icon
                icon={selected ? iconMap.CircleDot : iconMap.Circle}
                size={18}
                color={selected ? th.colors.brand.bloom : th.colors.textSubtle}
              />
              <View style={styles.roleMeta}>
                <Text style={styles.roleName}>{tEnums(`organizationMemberRole.${option}`)}</Text>
                <Text style={styles.roleHint}>{t(`team.role_hint_${option}`)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <Text variant="caption" color={th.colors.textSubtle}>
        {t("team.invite_privacy_note")}
      </Text>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  segments: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  segment: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  segmentOn: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },
  segmentHovered: {
    borderColor: t.colors.borderStrong,
  },
  segmentText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  segmentTextOn: {
    color: t.colors.onAccent,
  },
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 42,
  },
  roles: {
    gap: t.space["2"],
  },
  role: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  roleSelected: {
    borderColor: t.colors.brand.bloom,
  },
  roleHovered: {
    borderColor: t.colors.borderStrong,
  },
  roleMeta: {
    flex: 1,
    minWidth: 0,
  },
  roleName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  roleHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 2,
  },
}))
