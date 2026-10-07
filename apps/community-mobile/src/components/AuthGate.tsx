import React, { useEffect } from "react"
import { View, StyleSheet, ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { makeThemedStyles, space, useTheme } from "@/theme"
import { useReducedMotion } from "@civfix/ui/theme"
import {
  IosKeyboardAvoidingView,
  PLAIN_SCROLL_HOST,
  Text,
  makeKeyboardAwareScrollHost,
} from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { Wordmark } from "@/components/Wordmark"
import { BootConnectivityNotice } from "@/components/BootConnectivity"
import { useBootGate } from "@/hooks/useBootGate"
import { LoadingSplash } from "@/components/LoadingSplash"
import { AuthOptions } from "@/components/AuthOptions"
import { ScreenHeader } from "@/components/ui/ScreenHeader"
import { useSignInProviders } from "@/hooks/useAuthFlow"

const { ScrollView: AuthScrollView } = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

function WelcomeOptions() {
  const { t } = useT("mobile-auth-welcome")
  const th = useTheme()
  const styles = useStyles()
  const { ready, enabled } = useSignInProviders()
  const unreachable = useBootGate().showNotice

  const revealed = ready || unreachable
  const reduceMotion = useReducedMotion() === true
  const fall = useSharedValue(0)
  useEffect(() => {
    if (!revealed) return
    fall.value = reduceMotion ? 1 : withSpring(1, { damping: 13, stiffness: 120, mass: 0.9 })
  }, [revealed, reduceMotion, fall])
  const style = useAnimatedStyle(() => ({
    opacity: fall.value,
    transform: [{ translateY: (1 - fall.value) * -32 }],
  }))

  if (!ready && !unreachable) {
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
      {unreachable ? (
        <View style={styles.connectivity}>
          <BootConnectivityNotice />
        </View>
      ) : null}
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

  if (mode === "loading") {
    return <LoadingSplash />
  }
  return (
    <IosKeyboardAvoidingView style={styles.root}>
      {showBack ? (
        <View style={styles.header}>
          <ScreenHeader />
        </View>
      ) : null}
      <AuthScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.welcome,
          {
            paddingTop: showBack ? 0 : insets.top,
            paddingBottom: insets.bottom + space["8"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark size={88} />
        <View style={styles.welcomeOptions}>
          <WelcomeOptions />
        </View>
      </AuthScrollView>
    </IosKeyboardAvoidingView>
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
  connectivity: {
    marginTop: t.space["6"],
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
