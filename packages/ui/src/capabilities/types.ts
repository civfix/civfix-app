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
  capture(opts?: { mode?: "photo" | "video"; orientation?: "portrait" | "device" }): Promise<CapturedMedia | null>
  pickFromLibrary(): Promise<CapturedMedia | null>
  acceptFile?(item: unknown): Promise<CapturedMedia | null>
  prepareUpload(media: CapturedMedia): Promise<PreparedUpload>
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface GeolocationCapability {
  isAvailable(): boolean
  requestPermission?(): Promise<boolean>
  getCurrentPosition(): Promise<GeoPosition>
  watchPosition(onChange: (pos: GeoPosition) => void): () => void
}

export interface PushCapability {
  isAvailable(): boolean
  registerForToken(): Promise<string | null>
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

export interface ContactsInviteAdapter {
  available: boolean
  inviteContacts(opts: { message: string; url: string }): Promise<void>
  copyToClipboard?(text: string): Promise<void>
}

export interface PlatformCapabilities {
  camera: CameraCapability
  geolocation: GeolocationCapability
  push: PushCapability
  secureStore: SecureStoreCapability
  persistence: PersistenceCapability
  blurSurface: BlurSurfaceCapability
  haptics?: HapticsCapability
  openExternal?: OpenExternalCapability
  openInternalHref?: OpenInternalHrefCapability
  contactsInvite?: ContactsInviteAdapter
  clipboard?: ClipboardCapability
  calendarFile?: CalendarFileCapability
}
