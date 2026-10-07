import React, { useCallback, useMemo, useState } from "react"
import { View, StyleSheet } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { KeyboardPinnedFooter, KeyboardPinnedSurface, PrimaryButton } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { useAuthState } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { MemberPicker } from "./MemberPicker"
import { GroupIdentityFields } from "./GroupIdentityFields"
import { GroupWizardHeader } from "./GroupWizardHeader"
import {
  canProceedToIdentity,
  canCreateGroup,
  normalizeGroupDraft,
  type GroupWizardStep,
} from "./groupWizard"
import { useCreateGroupAndOpen } from "./useCreateGroupAndOpen"

export function NewGroupBody() {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()
  const { t } = useT("group-create")
  const { user } = useAuthState()
  const viewerId = user?.id ?? null

  const [step, setStep] = useState<GroupWizardStep>("members")
  const [selected, setSelected] = useState<PersonDTO[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const avatar = useComposerAttachments(1)
  const picked = avatar.attachments[0] ?? null

  const { submit, pending, submitError } = useCreateGroupAndOpen()

  const excludeIds = useMemo(() => (viewerId ? [viewerId] : []), [viewerId])

  const onBack = useCallback(() => {
    if (step === "identity") setStep("members")
    else useNavStore.getState().back()
  }, [step])

  const onNext = useCallback(() => {
    if (canProceedToIdentity(selected.length)) setStep("identity")
  }, [selected.length])

  const onCreate = useCallback(() => {
    submit(canCreateGroup(name, description) && !avatar.uploading, {
      kind: "group",
      visibility: "private",
      ...normalizeGroupDraft(name, description),
      memberIds: selected.map((p) => p.id),
      ...(picked?.uploadId ? { avatarUploadId: picked.uploadId } : {}),
    })
  }, [submit, name, description, avatar.uploading, selected, picked])

  const nextDisabled = !canProceedToIdentity(selected.length)
  const createDisabled = !canCreateGroup(name, description) || avatar.uploading || pending

  return (
    <KeyboardPinnedSurface style={styles.root}>
      <GroupWizardHeader
        title={step === "members" ? t("title_members") : t("title_identity")}
        backLabel={t("back_a11y")}
        onBack={onBack}
      />

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
            {submitError ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {t("create_error")}
              </Text>
            ) : null}
          </ScrollView>
          <KeyboardPinnedFooter style={styles.footer}>
            <PrimaryButton
              label={t("create")}
              onPress={onCreate}
              disabled={createDisabled}
              loading={pending}
            />
          </KeyboardPinnedFooter>
        </>
      )}
    </KeyboardPinnedSurface>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
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
