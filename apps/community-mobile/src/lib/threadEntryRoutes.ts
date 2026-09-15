import type { DetailEntry } from "@civfix/ui"

export interface ThreadEntryRoute {
  pathname: string
  params: Record<string, string>
}

export function threadEntryRoute(entry: DetailEntry): ThreadEntryRoute | null {
  switch (entry.kind) {
    case "person":
      return entry.id ? { pathname: "/people/[id]", params: { id: entry.id } } : null
    case "cleanup":
      return entry.id ? { pathname: "/cleanups/[id]", params: { id: entry.id } } : null
    case "pin":
      return entry.id ? { pathname: "/pin/[id]", params: { id: entry.id } } : null
    case "post":
    case "post-thread":
      return entry.id ? { pathname: "/post/[id]", params: { id: entry.id } } : null
    case "org":
      return entry.slug ? { pathname: "/orgs/[slug]", params: { slug: entry.slug } } : null
    case "composer":
      return entry.composerMode === "quote" && entry.targetPostId
        ? { pathname: "/compose", params: { mode: "quote", targetPostId: entry.targetPostId } }
        : { pathname: "/compose", params: {} }
    default:
      return null
  }
}
