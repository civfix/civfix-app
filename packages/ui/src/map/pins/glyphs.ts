export const DROP_PIN_GLYPH = "M12 5 V19 M5 12 H19"

export const PIN_GLYPHS: Record<string, string> = {
  hazard: "M12 4 L2 20 H22 L12 4 Z M12 10 v4 M12 17 v0.5",
  encampment: "M3.5 21 L14 3 M20.5 21 L10 3 M15.5 21 L12 15 L8.5 21 M3.5 21 H20.5",
  cleanup:
    "M6 6 H18 a2 2 0 0 1 2 2 V19 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 V8 a2 2 0 0 1 2 -2 Z M8 4 V7 M16 4 V7 M4 10 H20",
  other_volunteer:
    "M12 20 C12 20 4 14.5 4 9 C4 6.5 6 5 8 5 C9.8 5 11.2 6 12 7.5 C12.8 6 14.2 5 16 5 C18 5 20 6.5 20 9 C20 14.5 12 20 12 20 Z",
  trash:
    "M9 6 L9 5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 v1 M5 6 h14 M6 6 l1 12 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l1 -12 M10 11 v5 M14 11 v5",
  recycling: "M12 4 L8 11 H16 L12 4 Z M5 13 L3 17 L7 19 M19 13 L21 17 L17 19 M8 20 H16",
  graffiti: "M4 14 v3 a2 2 0 0 0 2 2 h2 v-3 M4 14 l9 -9 a2.83 2.83 0 0 1 4 4 l-9 9 H4 v-4 Z",
  water: "M12 3 C7 8 4 12 4 15 a8 8 0 0 0 16 0 c0 -3 -3 -7 -8 -12 Z",
  drop: DROP_PIN_GLYPH,
}

export function glyphForCategory(category: string): string {
  return PIN_GLYPHS[category] ?? PIN_GLYPHS.trash!
}
