import React, { useState } from "react"
import { MAX_BIO_LENGTH } from "@civfix/shared"
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

export interface BioEditorProps {
  currentBio: string | null | undefined
  saving?: boolean
  onSave: (bio: string) => Promise<void>
}

export function BioEditor({ currentBio, saving, onSave }: BioEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentBio ?? "")
  const [submitError, setSubmitError] = useState<string | null>(null)

  const current = (currentBio ?? "").trim()
  const trimmed = draft.trim()
  const valid = trimmed.length <= MAX_BIO_LENGTH
  const unchanged = trimmed === current
  const canSave = !saving && valid && !unchanged

  const begin = () => {
    setDraft(currentBio ?? "")
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
      .catch((err: unknown) => setSubmitError(t(profileSaveErrorKey(err, "bio.error.generic"))))
  }

  return (
    <>
      <SettingsRow
        icon="FileText"
        label={t("bio.label")}
        sub={current.length > 0 ? current : t("bio.add")}
        onPress={begin}
      />
      <ModalCardSheet
        visible={editing}
        onClose={cancel}
        onCommit={save}
        headerIcon="FileText"
        title={t("bio.label")}
        dismissLabel={t("bio.dismiss")}
        error={submitError}
        actions={
          <>
            <SecondaryButton label={t("bio.cancel")} onPress={cancel} size="sm" />
            <PrimaryButton
              label={t("bio.save")}
              onPress={save}
              loading={saving}
              disabled={!canSave}
            />
          </>
        }
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
      </ModalCardSheet>
    </>
  )
}
