import React, { useState } from "react"
import { Text } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SettingsRow,
  TextField,
} from "../../primitives"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../../data/errorCode"
import { useEditorStyles } from "./editorStyles"

const MAX_DISPLAY_NAME_LENGTH = 80

export interface DisplayNameEditorProps {
  currentName: string
  saving?: boolean
  onSave: (displayName: string) => Promise<void>
}

export function DisplayNameEditor({ currentName, saving, onSave }: DisplayNameEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentName)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const trimmed = draft.trim()
  const valid = trimmed.length > 0 && trimmed.length <= MAX_DISPLAY_NAME_LENGTH
  const unchanged = trimmed === currentName.trim()
  const canSave = !saving && valid && !unchanged

  const begin = () => {
    setDraft(currentName)
    setSubmitError(null)
    setEditing(true)
  }
  const cancel = () => {
    setSubmitError(null)
    setEditing(false)
  }
  const save = () => {
    if (!canSave) return
    setSubmitError(null)
    void onSave(trimmed)
      .then(() => setEditing(false))
      .catch((err: unknown) => setSubmitError(t(profileSaveErrorKey(err, "name.error.generic"))))
  }

  const hint = (() => {
    if (submitError) return { text: "", tone: "muted" as const }
    if (!valid) return { text: t("name.hint.length"), tone: "error" as const }
    if (unchanged) return { text: t("name.hint.current"), tone: "muted" as const }
    return { text: "", tone: "muted" as const }
  })()

  return (
    <>
      <SettingsRow icon="User" label={t("name.change")} sub={currentName} onPress={begin} />
      <ModalCardSheet
        visible={editing}
        onClose={cancel}
        onCommit={save}
        headerIcon="User"
        title={t("name.change")}
        dismissLabel={t("name.dismiss")}
        error={submitError}
        actions={
          <>
            <SecondaryButton label={t("name.cancel")} onPress={cancel} size="sm" />
            <PrimaryButton
              label={t("name.save")}
              onPress={save}
              loading={saving}
              disabled={!canSave}
            />
          </>
        }
      >
        <Text style={styles.note}>{t("name.note")}</Text>
        <TextField
          placeholder={t("name.placeholder")}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
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
      </ModalCardSheet>
    </>
  )
}
