import React from "react"
import { Text, TextLink } from "../../typography"
import { TextField } from "../../primitives"
import { donationUrlHost, safeDonationUrl } from "../../primitives/donationUrl"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../../data/errorCode"
import { useEditorStyles } from "./editorStyles"
import { SettingsEditorSheet } from "./SettingsEditorSheet"
import { useSheetEditor } from "./useSheetEditor"
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
  const editor = useSheetEditor({
    initial: currentUrl ?? "",
    save: onSave,
    mapError: (err) => t(profileSaveErrorKey(err, "editor.error")),
  })
  const { draft, setDraft, commit } = editor

  const saved = currentUrl ?? null
  const savedSafe = safeDonationUrl(saved)
  const fieldError = donationLinkFieldError(draft)
  const valid = fieldError === null
  const dirty = donationLinkDirty(draft, saved)
  const canSave = !saving && valid && dirty

  const save = () => {
    if (!canSave) return
    commit(normalizeDonationLink(draft))
  }
  const remove = () => {
    if (saving || saved === null) return
    commit(null)
  }

  return (
    <SettingsEditorSheet
      editor={editor}
      icon="HandHeart"
      label={t("editor.title")}
      sub={savedSafe ? donationUrlHost(savedSafe) : t("editor.add")}
      dismissLabel={t("editor.dismiss")}
      cancelLabel={t("common:cancel")}
      saveLabel={t("editor.save")}
      saving={saving}
      canSave={canSave}
      onCommit={save}
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
    </SettingsEditorSheet>
  )
}
