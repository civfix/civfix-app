export interface AnnounceOptions {
  priority?: "polite" | "assertive"
}

export type AnnounceFn = (message: string, opts?: AnnounceOptions) => void
