import React from "react"
import { isValidHandle } from "@civfix/shared"
import { Text } from "../../typography"
import { SettingsRow, TextField } from "../../primitives"
import { useHandleAvailability } from "../../data"
import { useLocale, useT } from "../../i18n"
import { appErrorCode } from "../../data/errorCode"
import { dayLabel, todayKey, type DayLabelOptions } from "../relativeTime"
import { useEditorStyles } from "./editorStyles"
import { SettingsEditorSheet } from "./SettingsEditorSheet"
import { useSheetEditor } from "./useSheetEditor"

type Translate = (key: string, options?: Record<string, unknown>) => string

const HANDLE_MAX_LENGTH = 20

function changeHandleErrorMessage(err: unknown, t: Translate): string {
  switch (appErrorCode(err)) {
    case "RATE_LIMITED":
      return t("handle.error.rate_limited")
    case "CONFLICT":
      return t("handle.error.taken")
    case "VALIDATION":
      return t("handle.error.not_allowed")
    default:
      return t("handle.error.generic")
  }
}

export interface ChangeUsernameEditorProps {
  currentHandle: string | null | undefined
  lockedUntil: string | null | undefined
  saving?: boolean
  onSave: (handle: string) => Promise<void>
}

export function ChangeUsernameEditor({
  currentHandle,
  lockedUntil,
  saving,
  onSave,
}: ChangeUsernameEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const { t: tDate } = useT("common-datetime")
  const { locale } = useLocale()
  const now = todayKey()
  const dayLabels: DayLabelOptions = {
    today: tDate("day.today"),
    yesterday: tDate("day.yesterday"),
    locale,
    now,
  }
  const editor = useSheetEditor({
    initial: currentHandle ?? "",
    save: onSave,
    mapError: (err) => changeHandleErrorMessage(err, t),
  })
  const { draft, setDraft, submitError } = editor

  const lockMs = lockedUntil ? new Date(lockedUntil).getTime() : NaN
  const locked = !Number.isNaN(lockMs) && lockMs > Date.now()

  const trimmed = draft.trim()
  const valid = isValidHandle(trimmed)
  const unchanged = trimmed.toLowerCase() === (currentHandle ?? "").trim().toLowerCase()
  const availability = useHandleAvailability(draft, currentHandle)

  const checking = valid && !unchanged && availability.isFetching
  const taken = availability.data ? !availability.data.available : false
  const reason = availability.data?.reason
  const canSave =
    !saving && valid && !unchanged && !checking && (availability.data?.available ?? false)

  const save = () => {
    if (!canSave) return
    editor.commit(trimmed)
  }

  const hint = (() => {
    if (submitError) return { text: "", tone: "muted" as const }
    if (trimmed.length === 0) {
      return { text: t("handle.hint.choose"), tone: "muted" as const }
    }
    if (!valid) {
      return { text: t("handle.hint.invalid_format"), tone: "error" as const }
    }
    if (unchanged) return { text: t("handle.hint.current"), tone: "muted" as const }
    if (checking) return { text: t("handle.hint.checking"), tone: "muted" as const }
    if (taken) {
      const text =
        reason === "reserved"
          ? t("handle.availability.reserved")
          : reason === "invalid"
            ? t("handle.availability.invalid")
            : t("handle.availability.taken")
      return { text, tone: "error" as const }
    }
    if (availability.data?.available) return { text: t("handle.hint.available"), tone: "ok" as const }
    return { text: "", tone: "muted" as const }
  })()

  if (locked) {
    return (
      <SettingsRow
        icon="AtSign"
        label={t("handle.change")}
        sub={t("handle.cooldown_locked", { date: dayLabel(lockedUntil as string, dayLabels) })}
        disabled
      />
    )
  }

  return (
    <SettingsEditorSheet
      editor={editor}
      icon="AtSign"
      label={t("handle.change")}
      sub={currentHandle ? `@${currentHandle}` : t("handle.set")}
      dismissLabel={t("handle.dismiss")}
      cancelLabel={t("handle.cancel")}
      saveLabel={t("handle.save")}
      saving={saving}
      canSave={canSave}
      onCommit={save}
    >
      <Text style={styles.note}>{t("handle.cooldown_note")}</Text>
      <TextField
        placeholder={t("handle.placeholder")}
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={HANDLE_MAX_LENGTH}
        editable={!saving}
        accessibilityLabel={t("handle.field_label")}
      />
      {hint.text ? (
        <Text
          style={[
            styles.hint,
            hint.tone === "error" ? styles.hintError : hint.tone === "ok" ? styles.hintOk : null,
          ]}
          numberOfLines={2}
        >
          {hint.text}
        </Text>
      ) : null}
    </SettingsEditorSheet>
  )
}
