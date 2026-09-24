import React, { useCallback, useState } from "react"
import { View, Pressable } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { EventTeamInviteIdentifierKind, EventTeamRole } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
  webTransition,
} from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  modalSheetInputFocusedStyle,
  modalSheetInputStyle,
  useToast,
} from "../../primitives"
import { useT } from "../../i18n"
import { useInviteEventTeamMember } from "../../data/hooks/host"
import { appErrorCode } from "../errorCode"
import { eventTeamTiers } from "./eventTeamTiers"
import {
  INVITE_IDENTIFIER_MAX,
  inviteErrorKey,
  inviteIdentifierErrorKey,
  inviteIdentifierValue,
} from "./hostTeamModel"

const IDENTIFIER_KINDS: readonly EventTeamInviteIdentifierKind[] = ["handle", "email"]

export interface HostTeamInviteSheetProps {
  visible: boolean
  cleanupId: string
  onClose: () => void
}

export function HostTeamInviteSheet({ visible, cleanupId, onClose }: HostTeamInviteSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-team")
  const toast = useToast()
  const invite = useInviteEventTeamMember(cleanupId)

  const [identifierKind, setIdentifierKind] = useState<EventTeamInviteIdentifierKind>("handle")
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState<EventTeamRole>("staff")
  const [focused, setFocused] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const onClosed = useCallback(() => {
    setIdentifierKind("handle")
    setIdentifier("")
    setRole("staff")
    setErrorText(null)
    setFocused(false)
    if (!invite.isPending) invite.reset()
  }, [invite])

  const tiers = eventTeamTiers()
  const value = inviteIdentifierValue(identifierKind, identifier)
  const canSubmit = value !== null && !invite.isPending

  const onPickKind = useCallback((kind: EventTeamInviteIdentifierKind) => {
    setIdentifierKind(kind)
    setIdentifier("")
    setErrorText(null)
  }, [])

  const submit = useCallback(() => {
    if (invite.isPending) return
    if (value === null) {
      setErrorText(t(inviteIdentifierErrorKey(identifierKind)))
      return
    }
    setErrorText(null)
    invite.mutate(
      { identifierKind, identifier: value, role },
      {
        onSuccess: () => {
          toast.show(t("invite.sent"), { variant: "success" })
          onClose()
        },
        onError: (err) => setErrorText(t(inviteErrorKey(appErrorCode(err)))),
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
      title={t("invite.title")}
      dismissLabel={t("invite.dismiss_a11y")}
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
            label={t("invite.send")}
            onPress={submit}
            loading={invite.isPending}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <Text variant="label">{t("invite.identifier_kind")}</Text>
      <SegmentedControl
        label={t("invite.identifier_kind")}
        options={IDENTIFIER_KINDS.map((kind) => ({
          key: kind,
          label: kind === "email" ? t("invite.by_email") : t("invite.by_handle"),
        }))}
        selected={identifierKind}
        onSelect={(next) => onPickKind(next as EventTeamInviteIdentifierKind)}
        disabled={invite.isPending}
      />

      <Text variant="label">
        {identifierKind === "email" ? t("invite.email") : t("invite.handle")}
      </Text>
      <TextInput
        value={identifier}
        onChangeText={(next) => setIdentifier(next.slice(0, INVITE_IDENTIFIER_MAX))}
        editable={!invite.isPending}
        maxLength={INVITE_IDENTIFIER_MAX}
        accessibilityLabel={identifierKind === "email" ? t("invite.email") : t("invite.handle")}
        placeholderTextColor={th.colors.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={identifierKind === "email" ? "email-address" : "default"}
        textContentType={identifierKind === "email" ? "emailAddress" : "username"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? modalSheetInputFocusedStyle(th) : null]}
      />

      <Text variant="label">{t("invite.role")}</Text>
      <View style={styles.tiers} accessibilityRole="radiogroup" accessibilityLabel={t("invite.role")}>
        {tiers.map((tier) => {
          const selected = tier.role === role
          return (
            <Pressable
              key={tier.role}
              onPress={() => setRole(tier.role)}
              disabled={invite.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: invite.isPending }}
              accessibilityLabel={t(tier.labelKey)}
              {...focusRingProps}
              style={(state) => [
                styles.tier,
                webTransition,
                webCursor(invite.isPending),
                selected ? styles.tierSelected : null,
                !selected && webHover(state) ? styles.tierHovered : null,
                state.pressed && !invite.isPending ? styles.tierPressed : null,
              ]}
            >
              <Icon
                icon={selected ? iconMap.CircleDot : iconMap.Circle}
                size={18}
                color={selected ? th.colors.text : th.colors.textSubtle}
              />
              <View style={styles.tierMeta}>
                <Text style={styles.tierName}>{t(tier.labelKey)}</Text>
                <Text style={styles.tierHint}>{t(tier.hintKey)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <Text variant="caption" color={th.colors.textSubtle}>
        {t("invite.privacy_note")}
      </Text>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 42,
  },
  tiers: {
    gap: t.space["2"],
  },
  tier: {
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
  tierSelected: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.bgAlt,
  },
  tierHovered: {
    borderColor: t.colors.borderStrong,
  },
  tierPressed: {
    opacity: 0.9,
  },
  tierMeta: {
    flex: 1,
    minWidth: 0,
  },
  tierName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  tierHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
    marginTop: 2,
  },
}))
