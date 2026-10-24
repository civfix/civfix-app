export { CapabilitiesProvider } from "./context"
export type { CapabilitiesProviderProps } from "./context"
export {
  useCamera,
  useGeolocation,
  usePush,
  usePushPermission,
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
  PushPermissionCapability,
  PushPermissionStatus,
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
export { makeFakeCapabilities } from "./fakes"
export type { FakePushPermission } from "./fakes"
