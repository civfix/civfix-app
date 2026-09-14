import { useMemo } from "react"

export function viewerTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof zone === "string" && zone.length > 0 ? zone : "UTC"
  } catch {
    return "UTC"
  }
}

export function useViewerTimeZone(): string {
  return useMemo(() => viewerTimeZone(), [])
}
