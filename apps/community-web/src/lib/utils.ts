import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's stock font-size names, so it read the console's
 * `text-token-<n>` sizes as COLORS and dropped whichever `text-console-*` colour (or size) came
 * first in the string. Every primary ConsoleButton lost `text-console-surface` to `text-token-13`
 * and painted its label in the same ink as its background. Teaching it the token scale keeps a
 * size and a colour side by side, as they are meant to be.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [(value: string) => /^token-\d+$/.test(value)] }],
    },
  },
})

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind utilities.
 * Standard shadcn/ui helper.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
