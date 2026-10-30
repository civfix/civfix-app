import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { focusManager } from "@tanstack/react-query"
import { useCapabilities } from "./context"
import { NOOP_HAPTICS } from "./noopHaptics"
import type {
  CameraCapability,
  GeolocationCapability,
  PushPermissionStatus,
  SecureStoreCapability,
  HapticsCapability,
  OpenExternalCapability,
  OpenInternalHrefCapability,
  ClipboardCapability,
  CalendarFileCapability,
} from "./types"

export function useCamera(): CameraCapability {
  return useCapabilities().camera
}

export function useGeolocation(): GeolocationCapability {
  return useCapabilities().geolocation
}

export interface PushPermissionState {
  status: PushPermissionStatus | null
  request(): Promise<PushPermissionStatus>
  openSettings?: () => Promise<void>
}

// Re-read on every return to the foreground, since the permission can change in system or browser settings
// while the app is away. focusManager is fed by visibilitychange on web and AppState on mobile. Only the
// latest read or request may set the status, so a slow read that started first never overwrites a newer
// answer.
export function usePushPermission(): PushPermissionState {
  const pushPermission = useCapabilities().pushPermission
  const [status, setStatus] = useState<PushPermissionStatus | null>(null)
  const latest = useRef(0)
  const mounted = useRef(false)

  const settle = useCallback(
    async (read: Promise<PushPermissionStatus>): Promise<PushPermissionStatus> => {
      const ticket = ++latest.current
      const next = await read
      if (mounted.current && ticket === latest.current) setStatus(next)
      return next
    },
    [],
  )

  useEffect(() => {
    mounted.current = true
    void settle(pushPermission.status())
    const unsubscribe = focusManager.subscribe((focused) => {
      if (focused) void settle(pushPermission.status())
    })
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [pushPermission, settle])

  const request = useCallback(() => settle(pushPermission.request()), [pushPermission, settle])

  return useMemo(() => {
    const openSettings = pushPermission.openSettings
    return {
      status,
      request,
      ...(openSettings ? { openSettings: () => openSettings.call(pushPermission) } : {}),
    }
  }, [status, request, pushPermission])
}

export function useSecureStore(): SecureStoreCapability {
  return useCapabilities().secureStore
}

export function useHaptics(): HapticsCapability {
  return useCapabilities().haptics ?? NOOP_HAPTICS
}

export function useOpenExternal(): OpenExternalCapability | undefined {
  return useCapabilities().openExternal
}

export function useOpenInternalHref(): OpenInternalHrefCapability | undefined {
  return useCapabilities().openInternalHref
}

export function useClipboard(): ClipboardCapability | undefined {
  return useCapabilities().clipboard
}

export function useCalendarFile(): CalendarFileCapability | undefined {
  return useCapabilities().calendarFile
}
