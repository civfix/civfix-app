export interface PopoverMenuPress {
  onPress: () => void
  keepOpen?: boolean
}

/** `run` closes the menu and runs the action once it may (after the Modal dismisses, on iOS). */
export function pressPopoverMenuItem(item: PopoverMenuPress, run: (action: () => void) => void): void {
  if (item.keepOpen) item.onPress()
  else run(item.onPress)
}
