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
