import React from "react"
import { useT } from "@civfix/ui/i18n"
import { ReportStage } from "@/components/onboarding/stages/ReportStage"
import {
  OnboardingPageFrame,
  type OnboardingPageProps,
} from "@/components/onboarding/pages/OnboardingPageFrame"

export function ReportPage(props: OnboardingPageProps) {
  const { t } = useT("mobile-onboarding")
  return (
    <OnboardingPageFrame
      {...props}
      stage={<ReportStage active={props.active} reduceMotion={props.reduceMotion} />}
      title={t("report.title")}
      body={t("report.body")}
      caption={t("report.caption")}
    />
  )
}
