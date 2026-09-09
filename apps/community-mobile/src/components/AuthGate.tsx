import React, { useEffect } from "react"
import { View, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import type { OAuthProvider } from "@civfix/shared"
import { makeThemedStyles, theme, useTheme } from "@/theme"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { Wordmark } from "@/components/Wordmark"
import { LoadingSplash } from "@/components/LoadingSplash"
import { AuthOptions } from "@/components/AuthOptions"
import { ScreenHeader } from "@/components/ui/ScreenHeader"
import { useEnabledProviders } from "@/hooks/useAuthFlow"

const ALL_PROVIDERS: OAuthProvider[] = ["apple", "google", "email"]

function WelcomeOptions() {
  const { t } = useT("mobile-auth-welcome")
  const th = useTheme()
  const styles = useStyles()
  const providers = useEnabledProviders()
  const ready = !providers.isPlaceholderData
  const enabled = providers.data ?? ALL_PROVIDERS

  const fall = useSharedValue(0)
  useEffect(() => {
    if (ready) fall.value = withSpring(1, { damping: 13, stiffness: 120, mass: 0.9 })
  }, [ready, fall])
  const style = useAnimatedStyle(() => ({
    opacity: fall.value,
    transform: [{ translateY: (1 - fall.value) * -32 }],
  }))

  if (!ready) {
    return (
      <View style={styles.optionsLoading}>
        <ActivityIndicator color={th.colors.brand.bloom} />
      </View>
    )
  }

  return (
    <Animated.View style={style}>
      <Text variant="title" style={styles.tagline}>
        {t("tagline")}
      </Text>
      <Text variant="caption" style={styles.subtag}>
        {t("subtitle")}
      </Text>
      <View style={styles.options}>
        <AuthOptions enabled={enabled} />
      </View>
    </Animated.View>
  )
}

export function AuthGate({
  mode,
  showBack = false,
}: {
  mode: "loading" | "welcome"
  showBack?: boolean
}) {
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const keyboard = useAnimatedKeyboard()
  const scrollKeyboardStyle = useAnimatedStyle(() => ({
    marginBottom: Platform.OS === "android" ? keyboard.height.value : 0,
  }))

  if (mode === "loading") {
    return <LoadingSplash />
  }
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {showBack ? (
        <View style={styles.header}>
          <ScreenHeader />
        </View>
      ) : null}
      <Animated.ScrollView
        style={[styles.scroll, scrollKeyboardStyle]}
        contentContainerStyle={[
          styles.welcome,
          {
            paddingTop: showBack ? 0 : insets.top,
            paddingBottom: insets.bottom + theme.space["8"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark size={88} />
        <View style={styles.welcomeOptions}>
          <WelcomeOptions />
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
    paddingHorizontal: t.space["6"],
  },
  scroll: {
    flex: 1,
  },
  header: {
    marginHorizontal: -t.space["6"],
  },
  welcome: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeOptions: {
    alignSelf: "stretch",
    marginTop: t.space["8"],
  },
  tagline: {
    textAlign: "center",
  },
  subtag: {
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
    alignSelf: "center",
    marginTop: t.space["3"],
  },
  options: {
    marginTop: t.space["8"],
  },
  optionsLoading: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
  },
}))
