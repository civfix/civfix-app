import React, { useCallback } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { GroupInfoBody, Icon, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { seedEntry } from "@/components/MobileNavAdapter"
import { makeThemedStyles, useTheme } from "@/theme"

type RootStackNavigation = {
  getState: () => { index: number } | undefined
  reset: (state: { index: number; routes: { name: string }[] }) => void
}

export default function GroupInfoScreen() {
  const router = useRouter()
  const navigation = useNavigation<RootStackNavigation>()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const onBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace("/")),
    [router],
  )

  const onLeft = useCallback(() => {
    const stack = navigation.getState()
    const selfIndex = stack?.index ?? 0
    if (selfIndex >= 2) {
      router.dismiss(2)
      return
    }
    seedEntry({ kind: "messages" })
    navigation.reset({ index: 0, routes: [{ name: SHELL_ROUTE }] })
  }, [navigation, router])

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Icon icon={iconMap.ArrowLeft} size={BACK_ICON_SIZE} color={th.colors.text} />
        </Pressable>
        <View pointerEvents="none" style={styles.titleWrap}>
          <Text style={styles.title}>{t("title.group_info")}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      <GroupInfoBody
        id={id}
        onBack={onLeft}
        onOpenPerson={(navId) => router.push({ pathname: "/people/[id]", params: { id: navId } })}
      />
    </View>
  )
}

const BACK_ICON_SIZE = 20

const SHELL_ROUTE = "index"

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    position: "relative",
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  titleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  title: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 17,
    lineHeight: 22,
    color: t.colors.text,
  },
  headerSpacer: { flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
}))
