export const MAX_ICS_CHARS = 256 * 1024

export function calendarFileName(filename: string): string {
  const base = filename.split(/[\\/]/u).pop() ?? ""
  const safe = base.replace(/[^A-Za-z0-9._-]/gu, "-").replace(/^\.+/u, "")
  const named = (safe.length > 0 ? safe : "civfix-event.ics").slice(0, 116)
  return named.toLowerCase().endsWith(".ics") ? named : `${named}.ics`
}

export function calendarDocumentWritable(ics: string): boolean {
  return ics.length > 0 && ics.length <= MAX_ICS_CHARS
}

export function calendarShareSupported(os: string): boolean {
  return os === "ios"
}
