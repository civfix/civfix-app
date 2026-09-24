import type {
  PlatformCapabilities,
  CameraCapability,
  CapturedMedia,
  PreparedUpload,
  GeolocationCapability,
  PushCapability,
  SecureStoreCapability,
  BlurSurfaceCapability,
  HapticsCapability,
  OpenExternalCapability,
  OpenInternalHrefCapability,
  ClipboardCapability,
} from "../types"

// Inline bytes and no location: the fake ships in the web export's dev galleries, where it must never
// fetch from a third-party host or stand in for a device GPS fix.
const FAKE_CAPTURE_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR4nGOYtXg1SYhhVMOg0AAAdT0SkOo9AVoAAAAASUVORK5CYII="

export class FakeCamera implements CameraCapability {
  isAvailable(): boolean {
    return false
  }
  capture(_opts?: { mode?: "photo" | "video"; orientation?: "portrait" | "device" }): Promise<CapturedMedia | null> {
    return Promise.resolve({
      uri: FAKE_CAPTURE_URI,
      kind: "image",
      mime: "image/png",
      width: 16,
      height: 9,
    })
  }
  pickFromLibrary(): Promise<CapturedMedia | null> {
    return Promise.resolve(null)
  }
  prepareUpload(media: CapturedMedia): Promise<PreparedUpload> {
    return Promise.resolve({
      contentType: media.mime,
      byteSize: 0,
      sha256: "0".repeat(64),
      body: new ArrayBuffer(0),
    })
  }
}

class FakeGeolocation implements GeolocationCapability {
  isAvailable(): boolean {
    return false
  }
  requestPermission(): Promise<boolean> {
    return Promise.resolve(false)
  }
  getCurrentPosition(): Promise<never> {
    return Promise.reject(new Error("FakeGeolocation: location unavailable"))
  }
  watchPosition(_onChange: (pos: { latitude: number; longitude: number }) => void): () => void {
    return () => {}
  }
}

class FakePush implements PushCapability {
  isAvailable(): boolean {
    return false
  }
  registerForToken(): Promise<null> {
    return Promise.resolve(null)
  }
}

class MapKeyValueStore implements SecureStoreCapability {
  private readonly store = new Map<string, string>()
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.has(key) ? (this.store.get(key) as string) : null)
  }
  set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
    return Promise.resolve()
  }
  del(key: string): Promise<void> {
    this.store.delete(key)
    return Promise.resolve()
  }
}

const fakeBlurSurface: BlurSurfaceCapability = { supported: false }

export const NOOP_HAPTICS: HapticsCapability = {
  selection(): void {},
  impactLight(): void {},
  success(): void {},
  error(): void {},
}

const FAKE_OPEN_EXTERNAL_LOG_MAX = 50

function recordOpen(log: string[], url: string): void {
  log.push(url)
  if (log.length > FAKE_OPEN_EXTERNAL_LOG_MAX) log.splice(0, log.length - FAKE_OPEN_EXTERNAL_LOG_MAX)
}

export type FakeOpenExternal = OpenExternalCapability & { opened: string[]; openedInApp: string[] }

export function makeFakeOpenExternal(): FakeOpenExternal {
  const fake: FakeOpenExternal = {
    opened: [],
    openedInApp: [],
    open(url: string): Promise<void> {
      recordOpen(fake.opened, url)
      return Promise.resolve()
    },
    openInAppBrowser(url: string): Promise<void> {
      recordOpen(fake.openedInApp, url)
      return Promise.resolve()
    },
  }
  return fake
}

export type FakeOpenInternalHref = OpenInternalHrefCapability & { opened: string[] }

export function makeFakeOpenInternalHref(): FakeOpenInternalHref {
  const fake: FakeOpenInternalHref = {
    opened: [],
    open(path: string): boolean {
      recordOpen(fake.opened, path)
      return true
    },
  }
  return fake
}

class FakeClipboard implements ClipboardCapability {
  lastCopied: string | null = null
  setString(text: string): Promise<void> {
    this.lastCopied = text
    return Promise.resolve()
  }
}

export function makeFakeCapabilities(): PlatformCapabilities {
  return {
    camera: new FakeCamera(),
    geolocation: new FakeGeolocation(),
    push: new FakePush(),
    secureStore: new MapKeyValueStore(),
    persistence: new MapKeyValueStore(),
    blurSurface: fakeBlurSurface,
    haptics: NOOP_HAPTICS,
    openExternal: makeFakeOpenExternal(),
    openInternalHref: makeFakeOpenInternalHref(),
    clipboard: new FakeClipboard(),
  }
}
