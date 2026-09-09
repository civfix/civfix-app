import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { PrimaryButton } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { useCreateGroup, useAuthState } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { MemberPicker } from "./MemberPicker"
import { GroupIdentityFields } from "./GroupIdentityFields"
import { normalizeGroupDraft } from "./groupWizard"
import { shouldOfferChannelSkip } from "./channelSkip"
import {
  canProceedFromChannelIdentity,
  canCreateChannel,
  CHANNEL_DEFAULT_VISIBILITY,
  type ChannelWizardStep,
  type ChannelVisibility,
} from "./channelWizard"

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: ChannelVisibility; icon: IconName }> = [
  { value: "private", icon: "Lock" },
  { value: "public", icon: "Globe" },
]

export function NewChannelBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("channel-create")
  const { user } = useAuthState()
  const viewerId = user?.id ?? null

  const [step, setStep] = useState<ChannelWizardStep>("identity")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<ChannelVisibility>(CHANNEL_DEFAULT_VISIBILITY)
  const [selected, setSelected] = useState<PersonDTO[]>([])
  const [submitError, setSubmitError] = useState(false)

  const avatar = useComposerAttachments(1)
  const picked = avatar.attachments[0] ?? null

  const createGroup = useCreateGroup()

  const excludeIds = useMemo(() => (viewerId ? [viewerId] : []), [viewerId])

  const onBack = useCallback(() => {
    if (step === "members") setStep("visibility")
    else if (step === "visibility") setStep("identity")
    else useNavStore.getState().back()
  }, [step])

  const onNextIdentity = useCallback(() => {
    if (canProceedFromChannelIdentity(name, description) && !avatar.uploading) setStep("visibility")
  }, [name, description, avatar.uploading])

  const onCreate = useCallback(() => {
    if (!canCreateChannel(name, description) || avatar.uploading || createGroup.isPending) return
    setSubmitError(false)
    createGroup.mutate(
      {
        kind: "channel",
        visibility,
        ...normalizeGroupDraft(name, description),
        memberIds: selected.map((p) => p.id),
        ...(picked?.uploadId ? { avatarUploadId: picked.uploadId } : {}),
      },
      {
        onSuccess: (group) => {
          const nav = useNavStore.getState()
          nav.setStack([
            ...nav.stack.slice(0, -1),
            { kind: "thread", id: group.id, roomKind: "group", title: group.name },
          ])
        },
        onError: () => setSubmitError(true),
      },
    )
  }, [name, description, visibility, avatar.uploading, createGroup, selected, picked])

  const identityNextDisabled = !canProceedFromChannelIdentity(name, description) || avatar.uploading
  const createDisabled = !canCreateChannel(name, description) || avatar.uploading || createGroup.isPending

  const headerTitle =
    step === "identity"
      ? t("title")
      : step === "visibility"
        ? t("visibility_title")
        : t("add_members")

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("back_a11y")}
          hitSlop={8}
          {...focusRingProps}
          style={({ pressed }) => [styles.backBtn, pressed ? styles.backPressed : null]}
        >
          <Icon icon={iconMap.ArrowLeft} size={20} color={th.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {headerTitle}
        </Text>
        {shouldOfferChannelSkip(step, selected.length) ? (
          <Pressable
            onPress={onCreate}
            disabled={createDisabled}
            accessibilityRole="button"
            accessibilityLabel={t("skip")}
            hitSlop={8}
            {...focusRingProps}
            style={({ pressed }) => [styles.skipBtn, pressed ? styles.backPressed : null]}
          >
            <Text style={[styles.skipText, createDisabled ? styles.skipDisabled : null]}>{t("skip")}</Text>
          </Pressable>
        ) : null}
      </View>

      {step === "identity" ? (
        <>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={styles.identityContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <GroupIdentityFields
              avatar={avatar}
              name={name}
              onChangeName={setName}
              description={description}
              onChangeDescription={setDescription}
              labels={{
                avatarA11y: t("avatar_a11y"),
                avatarClearA11y: t("avatar_clear_a11y"),
                nameLabel: t("name_label"),
                namePlaceholder: t("name_placeholder"),
                descriptionLabel: t("description_label"),
                descriptionPlaceholder: t("description_placeholder"),
              }}
            />
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton label={t("next")} onPress={onNextIdentity} disabled={identityNextDisabled} />
          </View>
        </>
      ) : step === "visibility" ? (
        <>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={styles.identityContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.value
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setVisibility(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t(`${opt.value}_label`)}
                  {...focusRingProps}
                  style={({ pressed }) => [
                    styles.radioRow,
                    active ? styles.radioRowActive : null,
                    pressed ? styles.radioPressed : null,
                  ]}
                >
                  <Icon
                    icon={iconMap[opt.icon]}
                    size={20}
                    color={active ? th.colors.brand.moss : th.colors.textMuted}
                  />
                  <View style={styles.radioText}>
                    <Text style={styles.radioLabel}>{t(`${opt.value}_label`)}</Text>
                    <Text style={styles.radioHint}>{t(`${opt.value}_hint`)}</Text>
                  </View>
                  <View style={[styles.radioDot, active ? styles.radioDotActive : null]}>
                    {active ? <View style={styles.radioDotInner} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton label={t("next")} onPress={() => setStep("members")} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.fill}>
            <MemberPicker
              selected={selected}
              onChange={setSelected}
              excludeIds={excludeIds}
              emptyPromptBody={t("subscriber_prompt")}
            />
          </View>
          {submitError ? <Text style={[styles.errorText, styles.submitError]}>{t("create_error")}</Text> : null}
          <View style={styles.footer}>
            <PrimaryButton
              label={t("create")}
              onPress={onCreate}
              disabled={createDisabled}
              loading={createGroup.isPending}
            />
          </View>
        </>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -t.space["2"],
  },
  backPressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 16,
    color: t.colors.text,
  },
  skipBtn: {
    paddingHorizontal: t.space["2"],
    height: 36,
    justifyContent: "center",
    marginRight: -t.space["2"],
  },
  skipText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.brand.moss,
  },
  skipDisabled: {
    opacity: 0.4,
  },
  fill: {
    flex: 1,
  },
  identityContent: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["6"],
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    padding: t.space["3"],
    marginTop: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  radioRowActive: {
    borderColor: t.colors.brand.moss,
    backgroundColor: t.colors.moss["50"],
  },
  radioPressed: {
    opacity: 0.85,
  },
  radioText: {
    flex: 1,
    minWidth: 0,
  },
  radioLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.text,
  },
  radioHint: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.textMuted,
    marginTop: 2,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: {
    borderColor: t.colors.brand.moss,
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.brand.moss,
  },
  errorText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.bloom["600"],
    textAlign: "center",
    marginBottom: t.space["2"],
  },
  submitError: {
    paddingHorizontal: t.space["4"],
  },
  footer: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["4"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
