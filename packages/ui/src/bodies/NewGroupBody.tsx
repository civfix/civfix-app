import React, { useCallback, useMemo, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { KeyboardPinnedFooter, PrimaryButton } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { useCreateGroup, useAuthState } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { MemberPicker } from "./MemberPicker"
import { GroupIdentityFields } from "./GroupIdentityFields"
import {
  canProceedToIdentity,
  canCreateGroup,
  normalizeGroupDraft,
  type GroupWizardStep,
} from "./groupWizard"

export function NewGroupBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("group-create")
  const { user } = useAuthState()
  const viewerId = user?.id ?? null

  const [step, setStep] = useState<GroupWizardStep>("members")
  const [selected, setSelected] = useState<PersonDTO[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [submitError, setSubmitError] = useState(false)

  const avatar = useComposerAttachments(1)
  const picked = avatar.attachments[0] ?? null

  const createGroup = useCreateGroup()

  const excludeIds = useMemo(() => (viewerId ? [viewerId] : []), [viewerId])

  const onBack = useCallback(() => {
    if (step === "identity") setStep("members")
    else useNavStore.getState().back()
  }, [step])

  const onNext = useCallback(() => {
    if (canProceedToIdentity(selected.length)) setStep("identity")
  }, [selected.length])

  const onCreate = useCallback(() => {
    if (!canCreateGroup(name, description) || avatar.uploading || createGroup.isPending) return
    setSubmitError(false)
    createGroup.mutate(
      {
        kind: "group",
        visibility: "private",
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
  }, [name, description, avatar.uploading, createGroup, selected, picked])

  const nextDisabled = !canProceedToIdentity(selected.length)
  const createDisabled =
    !canCreateGroup(name, description) || avatar.uploading || createGroup.isPending

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
          {step === "members" ? t("title_members") : t("title_identity")}
        </Text>
      </View>

      {step === "members" ? (
        <>
          <View style={styles.pickerFill}>
            <MemberPicker selected={selected} onChange={setSelected} excludeIds={excludeIds} />
          </View>
          <KeyboardPinnedFooter style={styles.footer}>
            <PrimaryButton label={t("next")} onPress={onNext} disabled={nextDisabled} />
          </KeyboardPinnedFooter>
        </>
      ) : (
        <>
          <ScrollView
            style={styles.pickerFill}
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
            {submitError ? <Text style={styles.errorText}>{t("create_error")}</Text> : null}
          </ScrollView>
          <KeyboardPinnedFooter style={styles.footer}>
            <PrimaryButton
              label={t("create")}
              onPress={onCreate}
              disabled={createDisabled}
              loading={createGroup.isPending}
            />
          </KeyboardPinnedFooter>
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
  pickerFill: {
    flex: 1,
  },
  identityContent: {
    paddingHorizontal: t.space["4"],
    paddingBottom: t.space["6"],
  },
  errorText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.bloom["600"],
    textAlign: "center",
    marginBottom: t.space["2"],
  },
  footer: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["4"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
