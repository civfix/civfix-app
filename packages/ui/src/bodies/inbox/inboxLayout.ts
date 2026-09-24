import { Platform } from "react-native"
import { space } from "../../theme"

export const MIN_TOUCH_TARGET = 44
export const ROW_GUTTER = space["4"]
export const ROW_GAP = space["3"]
export const ROW_AVATAR = 48
export const SEPARATOR_INSET = ROW_GUTTER + ROW_AVATAR + ROW_GAP

export const IS_WEB = Platform.OS === "web"
