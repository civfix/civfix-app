import type { ThemeAccent } from "@civfix/shared"

const ACCENT_VAR_PREFIX = "--signup-accent"

const RAMP_STEPS = ["50", "100", "300", "600"] as const

export type SignupAccentVars = Record<string, string>

export function accentVars(accent: ThemeAccent): SignupAccentVars {
  const vars: SignupAccentVars = { [ACCENT_VAR_PREFIX]: `var(--${accent})` }
  for (const step of RAMP_STEPS) vars[`${ACCENT_VAR_PREFIX}-${step}`] = `var(--${accent}-${step})`
  return vars
}
