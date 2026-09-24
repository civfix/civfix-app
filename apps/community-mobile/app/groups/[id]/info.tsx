import React, { useCallback } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { GroupInfoBody } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { seedEntry } from "@/components/MobileNavAdapter"
import { RouteHeader } from "@/components/ui/RouteHeader"
import { ROOT_ROUTE_NAME } from "@/lib/nestedShellSignal"
import { makeThemedStyles } from "@/theme"

// The group chat and this info screen, stacked over the shell: leaving the group pops both.
const CHAT_AND_INFO_DEPTH = 2

type RootStackNavigation = {
  getState: () => { index: number } | undefined
  reset: (state: { index: number; routes: { name: string }[] }) => void
}

export default function GroupInfoScreen() {
  const router = useRouter()
  const navigation = useNavigation<RootStackNavigation>()
  const styles = useStyles()
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
    if (selfIndex >= CHAT_AND_INFO_DEPTH) {
      router.dismiss(CHAT_AND_INFO_DEPTH)
      return
    }
    seedEntry({ kind: "messages" })
    navigation.reset({ index: 0, routes: [{ name: ROOT_ROUTE_NAME }] })
  }, [navigation, router])

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <RouteHeader title={t("title.group_info")} onBack={onBack} />
      <GroupInfoBody
        id={id}
        onBack={onLeft}
        onOpenPerson={(navId) => router.push({ pathname: "/people/[id]", params: { id: navId } })}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}))
