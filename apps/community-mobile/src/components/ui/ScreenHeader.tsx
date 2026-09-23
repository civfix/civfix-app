import React from "react"
import { View, Pressable } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { makeThemedStyles, useTheme } from "@/theme"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

export interface ScreenHeaderProps {
  title?: string
  closeIcon?: boolean
  onBack?: () => void
  right?: React.ReactNode
  overlay?: boolean
}

export function ScreenHeader({
  title,
  closeIcon = false,
  onBack,
  right,
  overlay = false,
}: ScreenHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useT("mobile-a11y")
  const th = useTheme()
  const styles = useStyles()

  const handleBack = () => {
    if (onBack) return onBack()
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  const glyphColor = overlay ? th.colors.onScrim : th.colors.text

  return (
    <View
      style={[
        styles.header,
        overlay ? styles.overlay : styles.solid,
        { paddingTop: insets.top + th.space["2"] },
      ]}
    >
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={closeIcon ? t("button_close") : t("button_back")}
        hitSlop={10}
        style={({ pressed }) => [
          styles.iconBtn,
          overlay ? styles.iconBtnOverlay : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Ionicons name={closeIcon ? "close" : "chevron-back"} size={22} color={glyphColor} />
      </Pressable>

      {title ? (
        <Text
          variant="title"
          numberOfLines={1}
          accessibilityRole="header"
          color={glyphColor}
          style={styles.title}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}

      <View style={styles.rightSlot}>{right}</View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space["3"],
    paddingBottom: t.space["3"],
  },
  solid: {
    backgroundColor: t.colors.bg,
  },
  overlay: {
    backgroundColor: "transparent",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnOverlay: {
    backgroundColor: t.colors.scrim,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  rightSlot: {
    minWidth: 40,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
}))
