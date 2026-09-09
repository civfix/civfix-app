import React, { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { resolveScan } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles } from "@/theme"
import { ScreenHeader } from "@/components/ui/ScreenHeader"
import { TicketScanner } from "@/components/scan/TicketScanner"

export default function ScanScreen() {
  const router = useRouter()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { t } = useT("mobile-system")
  const { session } = useLocalSearchParams<{ session?: string }>()
  const [active, setActive] = useState(true)
  const settledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (settledRef.current) return
      settledRef.current = true
      resolveScan(null, session)
    }
  }, [session])

  const settle = useCallback(
    (token: string | null) => {
      if (settledRef.current) return
      settledRef.current = true
      setActive(false)
      resolveScan(token, session)
      if (router.canGoBack()) router.back()
      else router.replace("/")
    },
    [router, session],
  )

  const onScanned = useCallback((token: string) => settle(token), [settle])
  const onCancel = useCallback(() => settle(null), [settle])

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        closeIcon
        onBack={onCancel}
        title={t("scan.title")}
      />
      <TicketScanner active={active} onScanned={onScanned} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}))
