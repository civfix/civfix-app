export interface CleanupShareRef {
  pageSlug?: string | null | undefined
  referenceCode?: string | null | undefined
  id: string
}

export function cleanupSharePath(event: CleanupShareRef): string {
  return `/cleanups/${event.pageSlug ?? event.referenceCode ?? event.id}`
}
