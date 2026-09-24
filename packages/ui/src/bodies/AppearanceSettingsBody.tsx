import React from "react"
import { useT } from "../i18n"
import { AppearanceOptionList } from "./AppearanceOptionList"
import { SettingsSubpage } from "./settings/SettingsSubpage"

export function AppearanceSettingsBody() {
  const { t } = useT("appearance-settings")
  return (
    <SettingsSubpage title={t("title")} subtitle={t("subtitle")}>
      <AppearanceOptionList />
    </SettingsSubpage>
  )
}
