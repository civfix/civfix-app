import React, { useCallback, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { ErrorBoundaryProps } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { createI18n } from "@civfix/ui/i18n"
import { PRESSED_OPACITY_SUBTLE, type Theme } from "@/theme"
import { resolveActiveLocale } from "@/lib/locale"
import { queryClient } from "@/query/client"
import { purgeQueryCache } from "@/query/mmkvPersister"
import { useAppearanceTheme } from "@/theme/appearanceTheme"

const CRASH_COPY = {
  title: "Something went wrong",
  body: "civfix hit an unexpected problem. Try again - your reports and messages are safe.",
  action: "Try again",
}

function crashCopy(): typeof CRASH_COPY {
  try {
    const t = createI18n(resolveActiveLocale(null)).getFixedT(null, "mobile-system")
    return {
      title: t("crash.title", { defaultValue: CRASH_COPY.title }),
      body: t("crash.body", { defaultValue: CRASH_COPY.body }),
      action: t("crash.action", { defaultValue: CRASH_COPY.action }),
    }
  } catch {
    return CRASH_COPY
  }
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const copy = useMemo(crashCopy, [])
  const theme = useAppearanceTheme()
  const crash = useMemo(() => crashStyles(theme), [theme])

  const onRetry = useCallback(() => {
    try {
      purgeQueryCache(queryClient)
    } catch (err) {
      console.warn("[crash] the cached query data could not be purged before retrying", err)
    }
    void retry()
  }, [retry])

  return (
    <View style={crash.root}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Text style={crash.title}>{copy.title}</Text>
      <Text style={crash.body}>{copy.body}</Text>
      {__DEV__ ? <Text style={crash.detail}>{String(error?.message ?? error)}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [crash.action, pressed ? crash.actionPressed : null]}
      >
        <Text style={crash.actionLabel}>{copy.action}</Text>
      </Pressable>
    </View>
  )
}

function crashStyles(t: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: t.space["6"],
    },
    title: {
      fontSize: t.fontSize["24"],
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
    },
    body: {
      marginTop: t.space["3"],
      fontSize: t.fontSize["16"],
      color: t.colors.textMuted,
      textAlign: "center",
    },
    detail: {
      marginTop: t.space["3"],
      fontSize: t.fontSize["13"],
      color: t.colors.textSubtle,
      textAlign: "center",
    },
    action: {
      marginTop: t.space["8"],
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      height: 52,
      paddingHorizontal: t.space["5"],
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.brand.bloom,
    },
    actionPressed: {
      opacity: PRESSED_OPACITY_SUBTLE,
    },
    actionLabel: {
      fontSize: t.fontSize["16"],
      fontWeight: "600",
      color: t.colors.onAccent,
    },
  })
}
