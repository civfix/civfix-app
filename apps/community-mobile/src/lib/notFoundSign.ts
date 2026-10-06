/**
 * The 404's street sign (variant C), ported from community-web's
 * `stage-sign.tsx`: after a beat the left chain gives, the sign swings down on
 * its right bolt to a crooked rest, bounces and stays there. Worklets: the
 * frame callback steps them on the UI thread.
 */

const GRAVITY = 2400
const DAMPING = 0.9
const SNAP_AT = 0.7

/** How far the broken chain lets the sign drop: crooked, but still readable. */
export const SIGN_SAG = (-22 * Math.PI) / 180

export type SignSize = { width: number; height: number; boltInset: number; chain: number }

export type SignSwing = { elapsed: number; angle: number; spin: number }

export function hangSign(): SignSwing {
  "worklet"
  return { elapsed: 0, angle: 0, spin: 0 }
}

/** Advances the swing; false once the sign has settled, and its angle is then exactly the sag. */
export function stepSign(swing: SignSwing, size: SignSize, dt: number): boolean {
  "worklet"
  swing.elapsed += dt
  if (swing.elapsed < SNAP_AT) return true
  // A rigid plate swinging on its right bolt.
  const comX = -(size.width / 2 - size.boltInset)
  const comY = size.height / 2
  const inertia = (size.width * size.width + size.height * size.height) / 12 + comX * comX + comY * comY
  const rx = comX * Math.cos(swing.angle) - comY * Math.sin(swing.angle)
  swing.spin += ((GRAVITY * rx) / inertia - swing.spin * DAMPING) * dt
  swing.angle += swing.spin * dt
  if (swing.angle < SIGN_SAG) {
    swing.angle = SIGN_SAG
    swing.spin = -swing.spin * 0.35
  }
  const settled = swing.angle - SIGN_SAG < 0.002 && Math.abs(swing.spin) < 0.2
  if (settled) {
    swing.angle = SIGN_SAG
    swing.spin = 0
  }
  return !settled
}

/** The left chain, from the bar to the left bolt of a sign tilted by `angle`: its length and its tilt. */
export function leftChain(size: SignSize, angle: number): { length: number; angle: number } {
  "worklet"
  const reach = size.width - 2 * size.boltInset
  const dx = reach * Math.cos(angle) - reach
  const dy = size.chain - reach * Math.sin(angle)
  return { length: Math.hypot(dx, dy), angle: Math.atan2(dx, dy) }
}
