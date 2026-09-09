import React from "react"
import { Stack } from "expo-router"
import { useTheme } from "@/theme"

export default function ReportLayout() {
  const th = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: th.colors.bg },
      }}
    />
  )
}
