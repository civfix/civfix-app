import { useCapabilities } from "./context"
import type {
  CameraCapability,
  GeolocationCapability,
  PushCapability,
  SecureStoreCapability,
  PersistenceCapability,
  BlurSurfaceCapability,
  HapticsCapability,
  OpenExternalCapability,
  ContactsInviteAdapter,
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

export function usePersistence(): PersistenceCapability {
  return useCapabilities().persistence
}

export function useBlurSurface(): BlurSurfaceCapability {
  return useCapabilities().blurSurface
}

const NO_HAPTICS: HapticsCapability = {
  selection(): void {},
  impactLight(): void {},
  success(): void {},
  error(): void {},
}

export function useHaptics(): HapticsCapability {
  return useCapabilities().haptics ?? NO_HAPTICS
}

export function useOpenExternal(): OpenExternalCapability | undefined {
  return useCapabilities().openExternal
}

export function useContactsInvite(): ContactsInviteAdapter | undefined {
  return useCapabilities().contactsInvite
}

export function useClipboard(): ClipboardCapability | undefined {
  return useCapabilities().clipboard
}

export function useCalendarFile(): CalendarFileCapability | undefined {
  return useCapabilities().calendarFile
}
