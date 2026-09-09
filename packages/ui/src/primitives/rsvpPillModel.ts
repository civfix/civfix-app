export type RsvpPillSize = "sm" | "md"

export function buildRsvpPillLayoutPlan(size: RsvpPillSize) {
  return {
    target: { minWidth: 44, minHeight: 44 },
    visual: { height: size === "sm" ? 30 : 34 },
  } as const
}
