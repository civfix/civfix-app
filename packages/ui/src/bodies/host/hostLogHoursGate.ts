export type HostLogHoursGate = "loading" | "error" | "denied" | "not-yet" | "editor"

export interface HostLogHoursGateInput {
  loading: boolean
  failed: boolean
  manages: boolean
  ended: boolean
}

export function hostLogHoursGate(input: HostLogHoursGateInput): HostLogHoursGate {
  if (input.loading) return "loading"
  if (input.failed) return "error"
  if (!input.manages) return "denied"
  return input.ended ? "editor" : "not-yet"
}
