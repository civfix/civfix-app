// react-native-mmkv for Node: each id's map outlives the instance that opened it, as an MMKV file outlives
// the app session, so a test can hold data under an id nothing opened yet.
export const mmkvFiles = new Map<string, Map<string, string>>()

export function mmkvFile(id: string): Map<string, string> {
  const existing = mmkvFiles.get(id)
  if (existing) return existing
  const created = new Map<string, string>()
  mmkvFiles.set(id, created)
  return created
}

export class MMKV {
  private readonly map: Map<string, string>

  constructor({ id }: { id: string }) {
    this.map = mmkvFile(id)
  }

  getString(key: string): string | undefined {
    return this.map.get(key)
  }

  set(key: string, value: string): void {
    this.map.set(key, value)
  }

  delete(key: string): void {
    this.map.delete(key)
  }

  getAllKeys(): string[] {
    return [...this.map.keys()]
  }

  clearAll(): void {
    this.map.clear()
  }
}
