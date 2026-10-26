import React, { useCallback, useEffect } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import * as Linking from "expo-linking"
import { usePathname, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Icon, Text, iconMap } from "@civfix/ui"
import { useAppConfig } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"
import { focusRingProps, useColorSchemeName, useTheme } from "@/theme"
import { APP_PLATFORM, APP_VERSION } from "@/config"
import { useBootGateStyles } from "@/components/BootConnectivity"
import { errorName } from "@/lib/errorName"
import { forceUpdateFor } from "@/lib/forceUpdate"
import { goHome } from "@/lib/goHome"

export function ForceUpdateGate() {
  const { data } = useAppConfig()
  const decision = forceUpdateFor(data, APP_PLATFORM, APP_VERSION)
  const router = useRouter()
  const pathname = usePathname()

  // iOS presents a modal route (About) above the root view, out of this overlay's reach, so a blocked
  // build closes every route down to the shell, and again whenever another one opens.
  useEffect(() => {
    if (decision.blocked && router.canDismiss()) goHome(router)
  }, [decision.blocked, pathname, router])

  if (!decision.blocked) return null
  return <ForceUpdateScreen storeUrl={decision.storeUrl} />
}

function ForceUpdateScreen({ storeUrl }: { storeUrl: string | null }) {
  const { t } = useT("mobile-update")
  const th = useTheme()
  const scheme = useColorSchemeName()
  const styles = useBootGateStyles()

  const openStore = useCallback(() => {
    if (!storeUrl) return
    Linking.openURL(storeUrl).catch((err: unknown) => {
      console.warn("[update] could not open the store", errorName(err))
    })
  }, [storeUrl])

  return (
    <View accessibilityViewIsModal style={[styles.gate, overlay.topmost]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.tile}>
        <Icon icon={iconMap.Download} size={22} color={th.colors.textMuted} />
      </View>
      <Text variant="title" accessibilityRole="header" color={th.colors.text} style={styles.title}>
        {t("title")}
      </Text>
      <Text variant="body" color={th.colors.textMuted} style={styles.body}>
        {t("body")}
      </Text>
      {storeUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={openStore}
          {...focusRingProps}
          style={({ pressed }) => [styles.primary, pressed ? styles.pressed : null]}
        >
          <Text style={styles.primaryLabel}>{t("update")}</Text>
        </Pressable>
      ) : (
        <Text variant="body" color={th.colors.text} style={styles.body}>
          {t(APP_PLATFORM === "ios" ? "from_app_store" : "from_google_play")}
        </Text>
      )}
    </View>
  )
}

// Above the loading gate (60), the first-run form (50) and onboarding (40).
const overlay = StyleSheet.create({
  topmost: {
    zIndex: 70,
    elevation: 70,
  },
})
