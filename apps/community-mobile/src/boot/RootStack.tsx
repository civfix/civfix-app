import React, { useEffect } from "react"
import { Platform } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SystemUI from "expo-system-ui"
import * as NavigationBar from "expo-navigation-bar"
import { useColorSchemeName, useTheme } from "@civfix/ui/theme"
import { LAUNCH_SCHEME, launchTheme } from "@/boot/launchTheme"

export function RootStack({ launchGate }: { launchGate: boolean }) {
  const liveScheme = useColorSchemeName()
  const scheme = launchGate ? LAUNCH_SCHEME : liveScheme
  const t = useTheme()

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(launchGate ? launchTheme.colors.bg : t.colors.bg)
  }, [launchGate, t.colors.bg])

  useEffect(() => {
    if (Platform.OS !== "android") return
    void NavigationBar.setButtonStyleAsync(scheme === "dark" ? "light" : "dark")
  }, [scheme])

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="messages/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen
          name="groups/[id]/info"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="messages/members/[roomKind]/[id]"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="about"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
    </>
  )
}
