import type { TextStyle } from "react-native"
import { themes, type Theme } from "../theme"

export const DETAIL_BACK_SIZE = 36
export const DETAIL_BACK_RADIUS = DETAIL_BACK_SIZE / 2
export const DETAIL_BACK_ICON_SIZE = 20

export const DETAIL_ACTION_SIZE = DETAIL_BACK_SIZE
export const DETAIL_ACTION_RADIUS = DETAIL_BACK_RADIUS
export const DETAIL_ACTION_ICON_SIZE = 18
export const DETAIL_ACTION_HIT_SLOP = 8

export function detailTitleStyle(fontSize: number, t: Theme = themes.light): TextStyle {
  return {
    fontFamily: t.fontFamily.bodyBold,
    fontSize,
    color: t.colors.text,
  }
}
