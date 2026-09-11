export const HEADER_CONTROL_SIZE = 52
export const HEADER_GLYPH_SIZE = 26
export const HEADER_AVATAR_SIZE = 52
export const HEADER_CONTROL_RADIUS = HEADER_CONTROL_SIZE / 2

/**
 * The avatar inside a SOLID header badge. The badge is a bordered surface, so an avatar the full
 * control size would cover its own ring and overflow it by the border width.
 */
export const HEADER_BADGED_AVATAR_SIZE = HEADER_AVATAR_SIZE - 6
