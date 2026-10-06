export const NOT_FOUND_VARIANTS = ["tiles", "pothole", "sign"] as const

export type NotFoundVariant = (typeof NOT_FOUND_VARIANTS)[number]

/** Uniform over the variants, fresh on every load: nothing is remembered. */
export function pickNotFoundVariant(random: () => number = Math.random): NotFoundVariant {
  return NOT_FOUND_VARIANTS[Math.floor(random() * NOT_FOUND_VARIANTS.length)] ?? "tiles"
}

export const NOT_FOUND_COPY = {
  eyebrow: "Error 404 · Page not found",
  cta: "Back to the map",
  tilesHint: "Psst: you can throw the blocks",
  variants: {
    tiles: {
      headline: "This page went missing.",
      supporting: "We'd file a report, but we don't know where it was. The link may be old or mistyped.",
    },
    pothole: {
      headline: "This page fell into a pothole.",
      supporting:
        "We've filed a report. A neighbor is on the way with a shovel. Until then, the link you followed doesn't lead anywhere.",
    },
    sign: {
      headline: "This street doesn't go anywhere.",
      supporting: "Even the sign gave up. The link you followed may be old or mistyped. We've let public works know.",
    },
  } satisfies Record<NotFoundVariant, { headline: string; supporting: string }>,
}
