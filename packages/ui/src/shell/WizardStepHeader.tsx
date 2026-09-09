import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"

export interface WizardStepHeaderProps {
  step: number
  total: number
  title: string
  help?: string
}

export function WizardStepHeader({ step, total, title, help }: WizardStepHeaderProps) {
  const styles = useStyles()
  const { t } = useT("common")
  return (
    <View style={styles.stepHead}>
      <View style={styles.progressRail}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.progressSeg, index < step ? styles.progressSegOn : null]}
          />
        ))}
      </View>
      <Text style={styles.stepCount}>{t("wizard_step_count", { current: step, total })}</Text>
      <Text variant="title" style={styles.stepTitle} accessibilityRole="header">
        {title}
      </Text>
      {help ? <Text style={styles.stepHelp}>{help}</Text> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  stepHead: {
    gap: t.space["1"],
  },
  progressRail: {
    flexDirection: "row",
    gap: t.space["1"],
    marginBottom: t.space["1"],
  },
  progressSeg: {
    flex: 1,
    height: t.space["1"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.border,
  },
  progressSegOn: {
    backgroundColor: t.colors.brand.bloom,
  },
  stepCount: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  stepTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    lineHeight: t.fontSize["20"] * t.lineHeight.snug,
  },
  stepHelp: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textMuted,
  },
}))
