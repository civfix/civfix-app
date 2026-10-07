import type { DetailEntry } from "@civfix/ui"
import type { NativeRouteTarget } from "@/lib/navBridge"

export function threadEntryRoute(entry: DetailEntry): NativeRouteTarget | null {
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
    case "announcements":
      return entry.id
        ? { pathname: "/cleanups/[id]/announcements", params: { id: entry.id } }
        : null
    case "announcement":
      return entry.id && entry.announcementId
        ? {
            pathname: "/cleanups/[id]/announcements/[announcementId]",
            params: { id: entry.id, announcementId: entry.announcementId },
          }
        : null
    case "event-analytics":
      return entry.id ? { pathname: "/cleanups/[id]/analytics", params: { id: entry.id } } : null
    case "org":
      return entry.slug ? { pathname: "/orgs/[slug]", params: { slug: entry.slug } } : null
    case "org-manage":
      return entry.slug ? { pathname: "/orgs/[slug]/manage", params: { slug: entry.slug } } : null
    case "composer":
      return entry.composerMode === "quote" && entry.targetPostId
        ? { pathname: "/compose", params: { mode: "quote", targetPostId: entry.targetPostId } }
        : { pathname: "/compose", params: {} }
    default:
      return null
  }
}
