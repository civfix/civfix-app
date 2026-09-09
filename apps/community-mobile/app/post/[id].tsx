import React from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { PostThreadBody, type DetailEntry } from "@civfix/ui"
import { threadEntryRoute } from "@/lib/threadEntryRoutes"
import { useTheme } from "@/theme"

export default function PostThreadScreen() {
  const router = useRouter()
  const th = useTheme()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"))
  const openEntry = React.useCallback(
    (entry: DetailEntry) => {
      const route = threadEntryRoute(entry)
      if (route) router.push({ pathname: route.pathname as never, params: route.params })
    },
    [router],
  )
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: th.colors.bg }}>
      <PostThreadBody id={id} onBack={back} onOpenEntry={openEntry} />
    </View>
  )
}
