export interface AuthorAsOption {
  id: string
  name: string
  logoUrl?: string | null
}

export function authorAsSelection(
  stored: string | null | undefined,
  organizations: readonly { id: string }[] | undefined,
): string | null {
  if (!stored || !organizations) return stored ?? null
  return organizations.some((org) => org.id === stored) ? stored : null
}
