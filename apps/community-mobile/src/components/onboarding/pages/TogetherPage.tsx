import React from "react"
import { useT } from "@civfix/ui/i18n"
import { TogetherStage } from "@/components/onboarding/stages/TogetherStage"
import {
  OnboardingPageFrame,
  type OnboardingPageProps,
} from "@/components/onboarding/pages/OnboardingPageFrame"

export function TogetherPage(props: OnboardingPageProps) {
  const { t } = useT("mobile-onboarding")
  return (
    <OnboardingPageFrame
      {...props}
      stage={<TogetherStage active={props.active} reduceMotion={props.reduceMotion} />}
      title={t("together.title")}
      body={t("together.body")}
      caption={t("together.caption")}
    />
  )
}
