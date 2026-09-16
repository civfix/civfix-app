import React, { useState } from "react"
import { Text, TextLink } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SettingsRow,
  TextField,
} from "../../primitives"
import { donationUrlHost, safeDonationUrl } from "../../primitives/donationUrl"
import { useT } from "../../i18n"
import { useEditorStyles } from "./editorStyles"
import {
  DONATION_LINK_MAX_LENGTH,
  donationLinkDirty,
  donationLinkFieldError,
  normalizeDonationLink,
} from "./donationLinkField"

export interface DonationLinkEditorProps {
  currentUrl: string | null | undefined
  saving?: boolean
  onSave: (url: string | null) => Promise<void>
}

export function DonationLinkEditor({ currentUrl, saving, onSave }: DonationLinkEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("donation-link")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentUrl ?? "")
  const [submitError, setSubmitError] = useState<string | null>(null)

  const saved = currentUrl ?? null
  const savedSafe = safeDonationUrl(saved)
  const fieldError = donationLinkFieldError(draft)
  const valid = fieldError === null
  const dirty = donationLinkDirty(draft, saved)
  const canSave = !saving && valid && dirty

  const begin = () => {
    setDraft(currentUrl ?? "")
    setSubmitError(null)
    setEditing(true)
  }
  const cancel = () => {
    setSubmitError(null)
    setEditing(false)
  }
  const commit = (url: string | null) => {
    setSubmitError(null)
    void onSave(url)
      .then(() => setEditing(false))
      .catch(() => setSubmitError(t("editor.error")))
  }
  const save = () => {
    if (!canSave) return
    commit(normalizeDonationLink(draft))
  }
  const remove = () => {
    if (saving || saved === null) return
    commit(null)
  }

  return (
    <>
      <SettingsRow
        icon="HandHeart"
        label={t("editor.title")}
        sub={savedSafe ? donationUrlHost(savedSafe) : t("editor.add")}
        onPress={begin}
      />
      <ModalCardSheet
        visible={editing}
        onClose={cancel}
        onCommit={save}
        headerIcon="HandHeart"
        title={t("editor.title")}
        dismissLabel={t("editor.dismiss")}
        error={submitError}
        actions={
          <>
            <SecondaryButton label={t("common:cancel")} onPress={cancel} size="sm" />
            <PrimaryButton
              label={t("editor.save")}
              onPress={save}
              loading={saving}
              disabled={!canSave}
            />
          </>
        }
      >
        <Text style={styles.note}>{t("editor.hint")}</Text>
        <TextField
          placeholder={t("editor.placeholder")}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={DONATION_LINK_MAX_LENGTH}
          editable={!saving}
          accessibilityLabel={t("editor.field_label")}
        />
        {fieldError ? (
          <Text style={[styles.hint, styles.hintError]}>{t("editor.invalid")}</Text>
        ) : null}
        {saved !== null ? (
          <TextLink variant="label" standalone onPress={remove} accessibilityLabel={t("editor.remove")}>
            {t("editor.remove")}
          </TextLink>
        ) : null}
      </ModalCardSheet>
    </>
  )
}
