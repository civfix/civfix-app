export { CapabilitiesProvider, useCapabilities } from "./context"
export type { CapabilitiesProviderProps } from "./context"
export {
  useCamera,
  useGeolocation,
  usePush,
  useSecureStore,
  useHaptics,
  useOpenExternal,
  useOpenInternalHref,
  useClipboard,
  useCalendarFile,
} from "./hooks"
export type {
  PlatformCapabilities,
  CameraCapability,
  CameraViewfinderProps,
  GeolocationCapability,
  PushCapability,
  SecureStoreCapability,
  PersistenceCapability,
  BlurSurfaceCapability,
  HapticsCapability,
  OpenExternalCapability,
  OpenInternalHrefCapability,
  ClipboardCapability,
  CalendarFileCapability,
  CapturedMedia,
  PreparedUpload,
  GeoPosition,
} from "./types"
export { webClipboardCapability } from "./webClipboard"
export { makeFakeCapabilities, makeFakeOpenInternalHref } from "./fakes"
