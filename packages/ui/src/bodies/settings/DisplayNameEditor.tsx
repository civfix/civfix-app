import React from "react"
import { DISPLAY_NAME_MAX_LENGTH } from "@civfix/shared"
import { Text } from "../../typography"
import { TextField } from "../../primitives"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../../data/errorCode"
import { useEditorStyles } from "./editorStyles"
import { SettingsEditorSheet } from "./SettingsEditorSheet"
import { useSheetEditor } from "./useSheetEditor"

export interface DisplayNameEditorProps {
  currentName: string
  saving?: boolean
  onSave: (displayName: string) => Promise<void>
}

export function DisplayNameEditor({ currentName, saving, onSave }: DisplayNameEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const editor = useSheetEditor({
    initial: currentName,
    save: onSave,
    mapError: (err) => t(profileSaveErrorKey(err, "name.error.generic")),
  })
  const { draft, setDraft, submitError } = editor

  const trimmed = draft.trim()
  const valid = trimmed.length > 0 && trimmed.length <= DISPLAY_NAME_MAX_LENGTH
  const unchanged = trimmed === currentName.trim()
  const canSave = !saving && valid && !unchanged

  const save = () => {
    if (!canSave) return
    editor.commit(trimmed)
  }

  const hint = (() => {
    if (submitError) return { text: "", tone: "muted" as const }
    if (!valid) return { text: t("name.hint.length"), tone: "error" as const }
    if (unchanged) return { text: t("name.hint.current"), tone: "muted" as const }
    return { text: "", tone: "muted" as const }
  })()

  return (
    <SettingsEditorSheet
      editor={editor}
      icon="User"
      label={t("name.change")}
      sub={currentName}
      dismissLabel={t("name.dismiss")}
      cancelLabel={t("name.cancel")}
      saveLabel={t("name.save")}
      saving={saving}
      canSave={canSave}
      onCommit={save}
    >
      <Text style={styles.note}>{t("name.note")}</Text>
      <TextField
        placeholder={t("name.placeholder")}
        value={draft}
        onChangeText={setDraft}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        editable={!saving}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel={t("name.field_label")}
      />
      {hint.text ? (
        <Text
          style={[styles.hint, hint.tone === "error" ? styles.hintError : null]}
          numberOfLines={2}
        >
          {hint.text}
        </Text>
      ) : null}
    </SettingsEditorSheet>
  )
}
