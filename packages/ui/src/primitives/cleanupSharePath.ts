export interface CleanupShareRef {
  pageSlug?: string | null
  referenceCode?: string | null
  id: string
}

export function cleanupSharePath(event: CleanupShareRef): string {
  return `/cleanups/${event.pageSlug ?? event.referenceCode ?? event.id}`
}
