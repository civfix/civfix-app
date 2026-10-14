import React, { useEffect } from "react"
import { Platform } from "react-native"
import { useRouter } from "expo-router"
import { setBrandAboutPresenter, setOnboardingTourPresenter, setScanPresenter } from "@civfix/ui"
import { setCameraNavigator } from "@/lib/nativeCamera"
import { codeScannerSupported } from "@/lib/scannerSupport"
import { useOnboardingStore } from "@/store/onboardingStore"
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel"

function RealtimeChannel(): null {
  useRealtimeChannel()
  return null
}

function CameraNavigatorBridge(): null {
  const router = useRouter()
  useEffect(() => {
    setCameraNavigator((captureId) => router.push({ pathname: "/report/camera", params: { captureId } }))
    return () => setCameraNavigator(null)
  }, [router])
  return null
}

function ScanPresenterBridge(): null {
  const router = useRouter()
  useEffect(() => {
    if (!codeScannerSupported(Platform.OS)) return
    setScanPresenter((session) => router.push({ pathname: "/scan", params: { session } }))
    return () => setScanPresenter(null)
  }, [router])
  return null
}

function BrandAboutBridge(): null {
  const router = useRouter()
  useEffect(() => {
    setBrandAboutPresenter(() => router.push("/about"))
    return () => setBrandAboutPresenter(null)
  }, [router])
  return null
}

function OnboardingTourBridge(): null {
  useEffect(() => {
    setOnboardingTourPresenter(() => useOnboardingStore.getState().replay())
    return () => setOnboardingTourPresenter(null)
  }, [])
  return null
}

export function AppBridges() {
  return (
    <>
      <RealtimeChannel />
      <CameraNavigatorBridge />
      <ScanPresenterBridge />
      <BrandAboutBridge />
      <OnboardingTourBridge />
    </>
  )
}
