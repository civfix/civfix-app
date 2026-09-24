import React from "react"
import { View, Pressable } from "react-native"
import type { EventTeamRole } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { ModalCardSheet, PrimaryButton, SecondaryButton } from "../../primitives"
import { useT } from "../../i18n"
import { useInviteEventTeamMember } from "../../data/hooks/host"
import { eventTeamTiers } from "../../data/eventTeamTiers"
import { inviteErrorKey, inviteIdentifierErrorKey } from "./hostTeamModel"
import { InviteIdentifierFields } from "./InviteIdentifierFields"
import { useInviteForm } from "./useInviteForm"

const DEFAULT_INVITE_ROLE: EventTeamRole = "staff"

export interface HostTeamInviteSheetProps {
  visible: boolean
  cleanupId: string
  onClose: () => void
}

export function HostTeamInviteSheet({ visible, cleanupId, onClose }: HostTeamInviteSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-team")
  const invite = useInviteEventTeamMember(cleanupId)
  const form = useInviteForm<EventTeamRole>({
    invite,
    defaultRole: DEFAULT_INVITE_ROLE,
    t,
    identifierErrorKey: inviteIdentifierErrorKey,
    errorKey: inviteErrorKey,
    sentMessage: () => t("invite.sent"),
    onClose,
  })
  const { role, setRole } = form

  const tiers = eventTeamTiers()

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onClosed={form.onClosed}
      onCommit={form.submit}
      headerIcon="UserPlus"
      headerIconColor={th.colors.moss["700"]}
      title={t("invite.title")}
      dismissLabel={t("invite.dismiss_a11y")}
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
            label={t("invite.send")}
            onPress={form.submit}
            loading={invite.isPending}
            disabled={!form.canSubmit}
          />
        </>
      }
    >
      <InviteIdentifierFields
        labels={{
          kind: t("invite.identifier_kind"),
          byEmail: t("invite.by_email"),
          byHandle: t("invite.by_handle"),
          email: t("invite.email"),
          handle: t("invite.handle"),
        }}
        identifierKind={form.identifierKind}
        identifier={form.identifier}
        onPickKind={form.onPickKind}
        focused={form.identifierFocused}
        onFocusChange={form.setIdentifierFocused}
        onChangeIdentifier={form.setIdentifier}
        disabled={invite.isPending}
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
