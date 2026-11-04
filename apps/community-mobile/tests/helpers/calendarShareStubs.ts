/**
 * Stands in for both `react-native` and `expo-file-system` in nativeCalendarFile's tests: one module, so
 * the share and the file write record into the same ordered log.
 */
interface CalendarStubControl {
  write: () => Promise<void>
  share: () => Promise<unknown>
}

export const events: string[] = []
export const shared: unknown[] = []
export const files: File[] = []

const defaults = (): CalendarStubControl => ({
  write: async () => {},
  share: async () => ({ action: "sharedAction" }),
})

export const control: CalendarStubControl = defaults()

export function resetCalendarStubs(): void {
  events.length = 0
  shared.length = 0
  files.length = 0
  Object.assign(control, defaults())
}

export const Platform = { OS: "ios" }

export const Share = {
  share(content: unknown): Promise<unknown> {
    events.push("share")
    shared.push(content)
    return control.share()
  },
}

export const Paths = { cache: "file:///cache" }

export class File {
  readonly uri: string
  exists = false
  writes = 0

  constructor(directory: string, name: string) {
    this.uri = `${directory}/${name}`
    files.push(this)
  }

  create(): void {
    events.push("create")
    this.exists = true
  }

  write(_content: string): Promise<void> {
    events.push("write")
    this.writes += 1
    return control.write().then(() => {
      events.push("write settled")
    })
  }

  delete(): void {
    events.push("delete")
    this.exists = false
  }
}
