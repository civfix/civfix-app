import React from "react"
import { MAX_BIO_LENGTH } from "@civfix/shared"
import { Text } from "../../typography"
import { TextField } from "../../primitives"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../../data/errorCode"
import { useEditorStyles } from "./editorStyles"
import { SettingsEditorSheet } from "./SettingsEditorSheet"
import { useSheetEditor } from "./useSheetEditor"

export interface BioEditorProps {
  currentBio: string | null | undefined
  saving?: boolean
  onSave: (bio: string) => Promise<void>
}

export function BioEditor({ currentBio, saving, onSave }: BioEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const editor = useSheetEditor({
    initial: currentBio ?? "",
    save: onSave,
    mapError: (err) => t(profileSaveErrorKey(err, "bio.error.generic")),
  })
  const { draft, setDraft } = editor

  const current = (currentBio ?? "").trim()
  const trimmed = draft.trim()
  const valid = trimmed.length <= MAX_BIO_LENGTH
  const unchanged = trimmed === current
  const canSave = !saving && valid && !unchanged

  const save = () => {
    if (!canSave) return
    editor.commit(trimmed)
  }

  return (
    <SettingsEditorSheet
      editor={editor}
      icon="FileText"
      label={t("bio.label")}
      sub={current.length > 0 ? current : t("bio.add")}
      dismissLabel={t("bio.dismiss")}
      cancelLabel={t("bio.cancel")}
      saveLabel={t("bio.save")}
      saving={saving}
      canSave={canSave}
      onCommit={save}
    >
      <Text style={styles.note}>{t("bio.note")}</Text>
      <TextField
        placeholder={t("bio.placeholder")}
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={MAX_BIO_LENGTH}
        editable={!saving}
        accessibilityLabel={t("bio.field_label")}
      />
      <Text style={styles.hint}>
        {t("bio.count", { current: draft.length, max: MAX_BIO_LENGTH })}
      </Text>
    </SettingsEditorSheet>
  )
}
