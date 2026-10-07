import { space, type Theme } from "../../theme"

export const CONTROL = space["10"]
export const COMPOSER_MAX = 120

const PILL_BUTTON_HEIGHT = 34

export function pillButton(t: Theme) {
  return {
    paddingHorizontal: t.space["4"],
    height: PILL_BUTTON_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  } as const
}
