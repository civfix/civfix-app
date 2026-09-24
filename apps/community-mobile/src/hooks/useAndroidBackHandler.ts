/**
 * The primary surfaces live in the shared nav store under a router that stays at "/", so without this
 * the OS back press falls through expo-router and exits instead of popping the open detail. Scoped with
 * `useFocusEffect` so full-screen routes keep the router's default back; precedence is `androidBackPlan`.
 */
import { useCallback } from "react"
import { BackHandler } from "react-native"
import { useFocusEffect } from "expo-router"
import { useNavStore, useReportFilterStore } from "@civfix/ui"
import { androidBackPlan } from "@/lib/androidBackPlan"

export function useAndroidBackHandler(): void {
  useFocusEffect(
    useCallback(() => {
      const onBackPress = (): boolean => {
        const filter = useReportFilterStore.getState()
        const nav = useNavStore.getState()
        switch (androidBackPlan({ layersOpen: filter.layersOpen, active: nav.active, view: nav.view })) {
          case "close-layers":
            filter.setLayersOpen(false)
            return true
          case "pop-detail":
            nav.back()
            return true
          case "leave-report":
            nav.leaveReportFlow()
            return true
          default:
            return false
        }
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress)
      return () => subscription.remove()
    }, []),
  )
}
