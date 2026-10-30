import type { ComponentType } from "react"
import type { DetailEntry } from "../nav/types"

export interface CapturedMedia {
  uri: string
  kind: "image" | "video"
  mime: string
  width?: number
  height?: number
  durationSec?: number
  location?: { lat: number; lng: number; source: "device" | "exif" }
  /**
   * Frees what the host allocated for `uri` (a web object URL and the bytes behind it). The holder
   * calls it once, when nothing can render or upload the uri any more; hosts whose uris own no
   * memory (native file paths) leave it out.
   */
  release?(): void
}

export interface PreparedUpload {
  contentType: string
  byteSize: number
  sha256: string
  body: ArrayBuffer | Blob
}

export interface CameraViewfinderProps {
  active: boolean
  resumeGrace?: boolean
  mode?: "photo" | "video"
  onCaptured(media: CapturedMedia): void
  onCancel?(): void
}

export interface CameraCapability {
  Viewfinder?: ComponentType<CameraViewfinderProps>
  isAvailable(): boolean
  capture(opts?: {
    mode?: "photo" | "video"
    orientation?: "portrait" | "device"
  }): Promise<CapturedMedia | null>
  pickFromLibrary(): Promise<CapturedMedia | null>
  acceptFile?(item: unknown): Promise<CapturedMedia | null>
  // Screens a picked video against the worker's limits before it is compressed or uploaded, resolving false
  // when its metadata cannot be read. Web checks length and frame size, since the browser uploads the
  // original file; mobile checks only length, since it compresses every video to a 1280 long edge first.
  exceedsVideoLimits?(media: CapturedMedia): Promise<boolean>
  prepareUpload(media: CapturedMedia): Promise<PreparedUpload>
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy?: number | undefined
}

export interface GeolocationCapability {
  isAvailable(): boolean
  requestPermission?(): Promise<boolean>
  getCurrentPosition(): Promise<GeoPosition>
  watchPosition(onChange: (pos: GeoPosition) => void): () => void
}

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unsupported"

// The web has no openSettings: a page cannot open the browser's site settings.
export interface PushPermissionCapability {
  status(): Promise<PushPermissionStatus>
  request(): Promise<PushPermissionStatus>
  openSettings?(): Promise<void>
}

export interface SecureStoreCapability {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  del(key: string): Promise<void>
}

export interface PersistenceCapability {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  del(key: string): Promise<void>
}

export interface BlurSurfaceCapability {
  supported: boolean
}

export interface HapticsCapability {
  selection(): void
  impactLight(): void
  success(): void
  error(): void
}

export interface ClipboardCapability {
  setString(text: string): Promise<void>
}

export interface OpenExternalCapability {
  open(url: string): Promise<void>
  openInAppBrowser?(url: string): Promise<void>
}

export interface OpenInternalHrefCapability {
  open(path: string): boolean
  entryFor?(path: string | null | undefined): DetailEntry | null
}

export interface CalendarFileCapability {
  save(input: { filename: string; ics: string }): Promise<boolean>
}

export interface PlatformCapabilities {
  camera: CameraCapability
  geolocation: GeolocationCapability
  pushPermission: PushPermissionCapability
  secureStore: SecureStoreCapability
  persistence: PersistenceCapability
  blurSurface: BlurSurfaceCapability
  haptics?: HapticsCapability
  openExternal?: OpenExternalCapability
  openInternalHref?: OpenInternalHrefCapability
  clipboard?: ClipboardCapability
  calendarFile?: CalendarFileCapability
}
