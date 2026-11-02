import React, { useCallback } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { LegalDocumentScreen, legalDocumentTypeOf } from "@civfix/ui"
import NotFoundScreen from "../+not-found"

export default function LegalDocumentRoute() {
  const { type } = useLocalSearchParams<{ type?: string | string[] }>()
  const router = useRouter()
  const documentType = legalDocumentTypeOf(type)

  const back = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }, [router])

  if (documentType === null) return <NotFoundScreen />
  return <LegalDocumentScreen type={documentType} onBack={back} />
}
