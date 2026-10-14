import React, { useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PostComposer } from "@civfix/ui"
import { composerParams } from "@/lib/composerParams"
import { useTheme } from "@/theme"

export default function ComposeScreen() {
  const router = useRouter()
  const th = useTheme()
  const insets = useSafeAreaInsets()
  const { mode, targetPostId } = composerParams(useLocalSearchParams<{ mode?: string; targetPostId?: string }>())
  const [composerMounted, setComposerMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setComposerMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"))
  return (
    <View style={{ flex: 1, backgroundColor: th.colors.bg, paddingTop: insets.top }}>
      {composerMounted ? (
        <PostComposer mode={mode} targetPostId={targetPostId} standalone={{ onBack: back }} />
      ) : null}
    </View>
  )
}
