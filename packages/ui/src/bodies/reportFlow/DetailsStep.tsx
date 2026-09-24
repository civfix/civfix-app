import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { TextField, Toggle } from "../../primitives"
import { useDraftReportStore } from "../../report/draftStore"
import { descriptionMaxLength } from "../../report/submit"
import { useT } from "../../i18n"
import { useFlowStyles } from "./flowStyles"

// Mirrors CreateReportRequestSchema's `title` max(120).
const REPORT_TITLE_MAX_LENGTH = 120

export function DetailsStep() {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const { t } = useT("report-wizard")
  const draft = useDraftReportStore((s) => s.draft)
  const setTitle = useDraftReportStore((s) => s.setTitle)
  const setDescription = useDraftReportStore((s) => s.setDescription)
  const setFlag = useDraftReportStore((s) => s.setFlag)
  return (
    <View style={flowStyles.stepBlock}>
      <TextField
        label={t("details.title_label")}
        placeholder={t("details.title_placeholder")}
        value={draft.title}
        onChangeText={setTitle}
        maxLength={REPORT_TITLE_MAX_LENGTH}
      />
      <TextField
        label={t("details.description_label")}
        placeholder={t("details.description_placeholder")}
        value={draft.description}
        onChangeText={setDescription}
        multiline
        maxLength={descriptionMaxLength(draft.flags)}
      />
      <View style={styles.toggles}>
        <Toggle
          label={t("details.flag_blocking")}
          value={draft.flags.blockingSidewalk}
          onValueChange={(v) => setFlag("blockingSidewalk", v)}
        />
        <Toggle
          label={t("details.flag_safety")}
          value={draft.flags.safetyHazard}
          onValueChange={(v) => setFlag("safetyHazard", v)}
        />
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  toggles: { gap: t.space["3"] },
}))
