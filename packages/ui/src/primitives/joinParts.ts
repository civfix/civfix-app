export const META_SEPARATOR = " · "

export function joinParts(parts: readonly (string | null)[], separator: string = META_SEPARATOR): string {
  return parts.filter((part): part is string => part !== null).join(separator)
}
