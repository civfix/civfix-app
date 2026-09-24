import type { TextStyle } from "react-native"
import type { Theme } from "../theme"
import { HEADER_CONTROL_RADIUS, HEADER_CONTROL_SIZE, HEADER_GLYPH_SIZE } from "../primitives/headerControls"

export const DETAIL_BACK_SIZE = HEADER_CONTROL_SIZE
export const DETAIL_BACK_RADIUS = HEADER_CONTROL_RADIUS
export const DETAIL_BACK_ICON_SIZE = HEADER_GLYPH_SIZE

export const DETAIL_ACTION_SIZE = DETAIL_BACK_SIZE
export const DETAIL_ACTION_RADIUS = DETAIL_BACK_RADIUS
export const DETAIL_ACTION_ICON_SIZE = HEADER_GLYPH_SIZE
export const DETAIL_ACTION_HIT_SLOP = 8

export function detailTitleStyle(fontSize: number, t: Theme): TextStyle {
  return {
    fontFamily: t.fontFamily.bodyBold,
    fontSize,
    color: t.colors.text,
  }
}
