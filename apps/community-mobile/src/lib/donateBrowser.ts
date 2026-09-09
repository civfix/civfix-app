export const DONATE_BROWSER_MODES = ["in-app", "system"] as const

export type DonateBrowserMode = (typeof DONATE_BROWSER_MODES)[number]

export const DEFAULT_DONATE_BROWSER_MODE: DonateBrowserMode = "in-app"

export function resolveDonateBrowserMode(raw: unknown): DonateBrowserMode {
  if (typeof raw !== "string") return DEFAULT_DONATE_BROWSER_MODE
  const value = raw.trim().toLowerCase()
  return (DONATE_BROWSER_MODES as readonly string[]).includes(value)
    ? (value as DonateBrowserMode)
    : DEFAULT_DONATE_BROWSER_MODE
}
