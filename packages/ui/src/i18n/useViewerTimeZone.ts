import { useMemo } from "react"

export function viewerTimeZone(): string {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone ? zone : "UTC"
  } catch {
    return "UTC"
  }
}

export function useViewerTimeZone(): string {
  return useMemo(() => viewerTimeZone(), [])
}
