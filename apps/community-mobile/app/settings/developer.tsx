import React from "react"
import { Redirect } from "expo-router"
import { API_URL } from "@/config"
import { developerScreenEnabled } from "@/lib/developerScreen"
import { DeveloperScreen } from "@/components/developer/DeveloperScreen"

export default function SettingsDeveloperScreen() {
  if (!developerScreenEnabled(API_URL, __DEV__)) return <Redirect href="/settings" />
  return <DeveloperScreen />
}
