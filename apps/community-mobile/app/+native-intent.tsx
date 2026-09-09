import * as WebBrowser from "expo-web-browser"
import { resolveIncomingPath } from "@/lib/universalLinks"

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const resolved = resolveIncomingPath(path)
    if (resolved.type === "internal") return resolved.path
    if (resolved.type === "external") {
      void WebBrowser.openBrowserAsync(resolved.url).catch(() => undefined)
    }
    return "/"
  } catch {
    return "/"
  }
}
