import React from "react"
import { View } from "react-native"
import { AppearanceOptionList } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles } from "@/theme"
import { ThemeStage } from "@/components/onboarding/stages/ThemeStage"
import {
  OnboardingPageFrame,
  type OnboardingPageProps,
} from "@/components/onboarding/pages/OnboardingPageFrame"

export function ThemePage(props: OnboardingPageProps) {
  const { t } = useT("mobile-onboarding")
  const styles = useStyles()
  return (
    <OnboardingPageFrame
      {...props}
      stage={<ThemeStage active={props.active} reduceMotion={props.reduceMotion} />}
      title={t("theme.title")}
      body={t("theme.body")}
      caption={t("theme.caption")}
    >
      <View style={styles.options}>
        <AppearanceOptionList />
      </View>
    </OnboardingPageFrame>
  )
}

const useStyles = makeThemedStyles((t) => ({
  options: {
    alignSelf: "stretch",
    marginTop: t.space["1"],
  },
}))
