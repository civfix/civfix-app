import React, { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { CapturedMedia } from "@civfix/ui/capabilities"
import { makeThemedStyles } from "@/theme"
import { resolveCameraCapture } from "@/lib/nativeCamera"
import { ReportViewfinder } from "@/components/report/ReportViewfinder"
import { ScreenHeader } from "@/components/ui/ScreenHeader"

export default function ReportCameraScreen() {
  const router = useRouter()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { captureId } = useLocalSearchParams<{ captureId?: string }>()
  const [active, setActive] = useState(true)

  useEffect(() => () => resolveCameraCapture(null, captureId), [captureId])

  const onCaptured = useCallback(
    (media: CapturedMedia) => {
      setActive(false)
      resolveCameraCapture(media, captureId)
      router.back()
    },
    [router, captureId],
  )
  const onCancel = useCallback(() => {
    setActive(false)
    router.back()
  }, [router])

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader onBack={onCancel} />
      <ReportViewfinder active={active} onCaptured={onCaptured} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}))
