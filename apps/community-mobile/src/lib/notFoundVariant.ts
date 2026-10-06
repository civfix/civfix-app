export const NOT_FOUND_VARIANTS = ["tiles", "pothole", "sign"] as const

export type NotFoundVariant = (typeof NOT_FOUND_VARIANTS)[number]

/** Uniform over the variants, fresh on every mount: nothing is remembered. */
export function pickNotFoundVariant(random: () => number = Math.random): NotFoundVariant {
  return NOT_FOUND_VARIANTS[Math.floor(random() * NOT_FOUND_VARIANTS.length)] ?? "tiles"
}
