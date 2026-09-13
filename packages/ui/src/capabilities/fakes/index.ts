import type {
  PlatformCapabilities,
  CameraCapability,
  CapturedMedia,
  PreparedUpload,
  GeolocationCapability,
  PushCapability,
  SecureStoreCapability,
  PersistenceCapability,
  BlurSurfaceCapability,
  HapticsCapability,
  OpenExternalCapability,
  OpenInternalHrefCapability,
  ContactsInviteAdapter,
  ClipboardCapability,
} from "../types"

export class FakeCamera implements CameraCapability {
  isAvailable(): boolean {
    return false
  }
  capture(_opts?: { mode?: "photo" | "video"; orientation?: "portrait" | "device" }): Promise<CapturedMedia | null> {
    return Promise.resolve({
      uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
      kind: "image",
      mime: "image/jpeg",
      width: 1280,
      height: 720,
      location: { lat: 37.7599, lng: -122.4148, source: "device" },
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

export class FakeGeolocation implements GeolocationCapability {
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

export class FakePush implements PushCapability {
  isAvailable(): boolean {
    return false
  }
  registerForToken(): Promise<null> {
    return Promise.resolve(null)
  }
}

export class FakeSecureStore implements SecureStoreCapability {
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

export class FakePersistence implements PersistenceCapability {
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

export const fakeBlurSurface: BlurSurfaceCapability = { supported: false }

export const fakeHaptics: HapticsCapability = {
  selection(): void {},
  impactLight(): void {},
  success(): void {},
  error(): void {},
}

export const FAKE_OPEN_EXTERNAL_LOG_MAX = 50

function recordOpen(log: string[], url: string): void {
  log.push(url)
  if (log.length > FAKE_OPEN_EXTERNAL_LOG_MAX) log.splice(0, log.length - FAKE_OPEN_EXTERNAL_LOG_MAX)
}

export const fakeOpenExternal: OpenExternalCapability & {
  opened: string[]
  openedInApp: string[]
} = {
  opened: [],
  openedInApp: [],
  open(url: string): Promise<void> {
    recordOpen(fakeOpenExternal.opened, url)
    return Promise.resolve()
  },
  openInAppBrowser(url: string): Promise<void> {
    recordOpen(fakeOpenExternal.openedInApp, url)
    return Promise.resolve()
  },
}

export const fakeOpenInternalHref: OpenInternalHrefCapability & { opened: string[] } = {
  opened: [],
  open(path: string): boolean {
    recordOpen(fakeOpenInternalHref.opened, path)
    return true
  },
}

export class FakeContactsInvite implements ContactsInviteAdapter {
  available = true
  invites: Array<{ message: string; url: string }> = []
  copied: string[] = []
  inviteContacts(opts: { message: string; url: string }): Promise<void> {
    this.invites.push(opts)
    return Promise.resolve()
  }
  copyToClipboard(text: string): Promise<void> {
    this.copied.push(text)
    return Promise.resolve()
  }
}

export class FakeClipboard implements ClipboardCapability {
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
    secureStore: new FakeSecureStore(),
    persistence: new FakePersistence(),
    blurSurface: fakeBlurSurface,
    haptics: fakeHaptics,
    openExternal: fakeOpenExternal,
    openInternalHref: fakeOpenInternalHref,
    clipboard: new FakeClipboard(),
  }
}
