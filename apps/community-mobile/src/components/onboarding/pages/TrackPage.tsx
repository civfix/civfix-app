import React from "react"
import { useT } from "@civfix/ui/i18n"
import { TrackStage } from "@/components/onboarding/stages/TrackStage"
import {
  OnboardingPageFrame,
  type OnboardingPageProps,
} from "@/components/onboarding/pages/OnboardingPageFrame"

export function TrackPage(props: OnboardingPageProps) {
  const { t } = useT("mobile-onboarding")
  return (
    <OnboardingPageFrame
      {...props}
      stage={<TrackStage active={props.active} reduceMotion={props.reduceMotion} />}
      title={t("track.title")}
      body={t("track.body")}
    />
  )
}
