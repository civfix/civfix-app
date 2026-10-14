export function matchesThreadQuery(
  thread: { title: string; last?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    thread.title.toLowerCase().includes(q) || (thread.last ?? "").toLowerCase().includes(q)
  )
}

export const UNREAD_BADGE_CAP = 99

export function unreadBadgeLabel(unread: number): string | number {
  return unread > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : unread
}

export type ThreadRowActionKey = "mute" | "markRead" | "delete"

export interface ThreadRowActionModel {
  key: ThreadRowActionKey
  label: string
  a11yLabel: string
  icon: "Bell" | "BellOff" | "CheckCheck" | "Trash2"
  tone: "mute" | "read" | "delete"
  destructive: boolean
}

export interface ThreadRowActionLabels {
  mute: string
  markRead: string
  delete: string
  deleteA11y: string
}

/** One ordered action list, so every surface that offers them agrees on which exist and in what order. */
export function threadRowActions({
  unread,
  muted,
  labels,
}: {
  unread: boolean
  muted: boolean
  labels: ThreadRowActionLabels
}): ThreadRowActionModel[] {
  const actions: ThreadRowActionModel[] = [
    {
      key: "mute",
      label: labels.mute,
      a11yLabel: labels.mute,
      icon: muted ? "Bell" : "BellOff",
      tone: "mute",
      destructive: false,
    },
  ]
  if (unread) {
    actions.push({
      key: "markRead",
      label: labels.markRead,
      a11yLabel: labels.markRead,
      icon: "CheckCheck",
      tone: "read",
      destructive: false,
    })
  }
  actions.push({
    key: "delete",
    label: labels.delete,
    a11yLabel: labels.deleteA11y,
    icon: "Trash2",
    tone: "delete",
    destructive: true,
  })
  return actions
}
