import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../../../theme"
import { Icon, Text, iconMap, type IconName } from "../../../typography"
import { IconTile, PrimaryButton, SectionCard } from "../../../primitives"
import { useT } from "../../../i18n"

const STEP_ICON = 16

const STEPS: readonly { key: string; icon: IconName }[] = [
  { key: "first_event.step_signup", icon: "Users" },
  { key: "first_event.step_checkin", icon: "QrCode" },
  { key: "first_event.step_hours", icon: "Clock" },
]

export interface FirstEventCardProps {
  onCreate: () => void
}

export function FirstEventCard({ onCreate }: FirstEventCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-dashboard")
  return (
    <SectionCard>
      <View style={styles.root}>
        <View style={styles.head}>
          <IconTile icon="Calendar" />
          <Text variant="heading" style={styles.title}>
            {t("first_event.title")}
          </Text>
        </View>
        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.key} style={styles.step}>
              <Icon icon={iconMap[step.icon]} size={STEP_ICON} color={th.colors.textSubtle} />
              <Text variant="label" style={styles.stepCopy}>
                {t(step.key)}
              </Text>
            </View>
          ))}
        </View>
        <PrimaryButton
          label={t("first_event.cta")}
          icon={iconMap.Plus}
          accessibilityLabel={t("create.a11y_personal")}
          onPress={onCreate}
          style={styles.cta}
        />
      </View>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["3"],
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  steps: {
    gap: t.space["2"],
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  cta: {
    marginTop: t.space["1"],
  },
}))
