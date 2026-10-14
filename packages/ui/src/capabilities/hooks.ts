import { useCapabilities } from "./context"
import { NOOP_HAPTICS } from "./noopHaptics"
import type {
  CameraCapability,
  GeolocationCapability,
  PushCapability,
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

export function usePush(): PushCapability {
  return useCapabilities().push
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
