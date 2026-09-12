import type { OpenExternalCapability } from "../capabilities"

export const consoleReachable = true

export function openConsolePath(path: string, openExternal?: OpenExternalCapability): void {
  if (typeof window !== "undefined" && window.location) {
    window.location.assign(path)
    return
  }
  void openExternal?.open(path)
}
