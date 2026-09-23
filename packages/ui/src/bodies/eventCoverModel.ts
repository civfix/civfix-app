export function eventCoverErrorKey(code: string | undefined): string {
  if (code === "MEDIA_REJECTED") return "cover.error_rejected"
  if (code === "RATE_LIMITED") return "cover.error_rate_limited"
  return "cover.error_generic"
}

export interface EventCoverState {
  coverMediaId: string | null
  coverPreviewUrl: string | null
}

export function eventCoverChanged(
  form: EventCoverState,
  existingCoverUrl: string | null | undefined,
): boolean {
  if (form.coverMediaId !== null) return true
  return (existingCoverUrl ?? null) !== null && form.coverPreviewUrl === null
}
