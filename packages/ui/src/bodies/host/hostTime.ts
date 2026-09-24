import type { UseRelativeTime } from "../../i18n"

export const DAY_MS = 86_400_000

// relativeAgo measures from its first argument to its second, so a future target goes second to read
// as the time left until it.
export function relativeUntil(
  relative: UseRelativeTime["relative"],
  target: number,
  now: number,
): string {
  return relative(now, target)
}
