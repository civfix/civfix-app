import React, { useCallback } from "react"
import { useRouter } from "expo-router"
import { BrandAboutCard } from "@civfix/ui"

export default function AboutScreen() {
  const router = useRouter()

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }, [router])

  return <BrandAboutCard onClose={dismiss} />
}
