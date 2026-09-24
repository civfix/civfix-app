import { useCallback, useMemo, useState } from "react"
import { Platform } from "react-native"
import type { EventKind, ReportCategory } from "@civfix/shared"
import { useLayoutMode } from "../theme"
import { useClipboard, useHaptics, useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { showOnMap } from "../map"
import { useToast } from "../primitives"
import {
  addressExternalPlan,
  addressMapsOptions,
  addressRowAffordances,
  appleMapsUrl,
  googleMapsUrl,
  type AddressMapsOption,
  type AddressPoint,
} from "./addressRowModel"

export type AddressFocusTarget =
  | { kind: "report"; id: string; category: ReportCategory }
  | { kind: "cleanup"; id: string; eventKind: EventKind }

function rowPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "web") return "web"
  return Platform.OS === "android" ? "android" : "ios"
}

export function useAddressActions({
  resolved,
  point,
  focusTarget,
  verified,
  title,
  variant,
}: {
  resolved: string
  point: AddressPoint | null | undefined
  focusTarget: AddressFocusTarget | null | undefined
  verified: boolean
  title: string | null | undefined
  variant: "full" | "compact"
}) {
  const { t } = useT("address")
  const mode = useLayoutMode()
  const [sheetOpen, setSheetOpen] = useState(false)
  const clipboard = useClipboard()
  const openExternal = useOpenExternal()
  const haptics = useHaptics()
  const toast = useToast()

  const urlInput = useMemo(
    () => ({
      address: resolved.length > 0 ? resolved : null,
      point: point ?? null,
      verified,
      title: title ?? null,
    }),
    [resolved, point, verified, title],
  )
  const appleUrl = useMemo(() => appleMapsUrl(urlInput), [urlInput])
  const googleUrl = useMemo(() => googleMapsUrl(urlInput), [urlInput])

  const hasExternalPlan =
    addressExternalPlan({
      platform: rowPlatform(),
      appleUrl,
      googleUrl,
      hasCopy: false,
    }).kind !== "none"

  const affordances = addressRowAffordances({
    variant,
    hasAddress: resolved.length > 0,
    hasPoint: point != null,
    hasFocusTarget: focusTarget != null,
    hasClipboard: clipboard !== undefined,
    hasOpenExternal: openExternal !== undefined,
    hasExternalPlan,
  })

  const onCopy = useCallback(() => {
    if (!clipboard || resolved.length === 0) return
    void clipboard.setString(resolved).then(
      () => {
        haptics.success()
        toast.show(t("row.copied"), { variant: "success" })
      },
      () => toast.show(t("row.copy_failed"), { variant: "error" }),
    )
  }, [clipboard, haptics, resolved, t, toast])

  const openUrl = useCallback(
    (url: string) => {
      if (!openExternal) return
      void openExternal.open(url)
    },
    [openExternal],
  )

  const chooseOption = useCallback(
    (option: AddressMapsOption) => {
      if (option === "copy") {
        onCopy()
        return
      }
      const url = option === "apple" ? appleUrl : googleUrl
      if (url) openUrl(url)
    },
    [appleUrl, googleUrl, onCopy, openUrl],
  )

  const sheetOptions = useMemo(
    () =>
      addressMapsOptions({
        platform: rowPlatform(),
        hasApple: appleUrl !== null,
        hasGoogle: googleUrl !== null,
        hasCopy: affordances.copy,
      }),
    [appleUrl, googleUrl, affordances.copy],
  )

  const onExternal = useCallback(() => {
    const plan = addressExternalPlan({
      platform: rowPlatform(),
      appleUrl,
      googleUrl,
      hasCopy: affordances.copy,
    })
    if (plan.kind === "direct") {
      openUrl(plan.url)
      return
    }
    if (plan.kind === "sheet") setSheetOpen(true)
  }, [appleUrl, googleUrl, affordances.copy, openUrl])

  const onFocusMap = useCallback(() => {
    if (!point || !focusTarget) return
    haptics.selection()
    showOnMap(
      mode,
      focusTarget.kind === "report"
        ? { kind: "report", id: focusTarget.id, lat: point.lat, lng: point.lng, category: focusTarget.category }
        : { kind: "cleanup", id: focusTarget.id, lat: point.lat, lng: point.lng, eventKind: focusTarget.eventKind },
    )
  }, [focusTarget, haptics, mode, point])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  return { affordances, sheetOpen, sheetOptions, onCopy, onExternal, onFocusMap, chooseOption, closeSheet }
}
