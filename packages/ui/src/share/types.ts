export interface SharePostTarget {
  title: string
  path: string
}

export interface SharePostHandle {
  open: (target: SharePostTarget) => void
}
