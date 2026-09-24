export const MIN_TOUCH_TARGET = 44

/**
 * The per-edge hitSlop that grows a control of `size` points to the 44pt floor. react-native-web drops
 * hitSlop, so a control that must clear 44pt on web needs a real box instead.
 */
export function hitSlopToTarget(size: number): number {
  return (MIN_TOUCH_TARGET - size) / 2
}
