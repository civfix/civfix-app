/**
 * The 404's pothole (variant B), ported from community-web's
 * `stage-pothole.tsx`: the 4s and the 0 drop once and land, the 0 crooked in
 * the hole, and then nothing moves. Each piece is laid out at rest; the fall
 * only sets an offset and a tilt relative to that rest, so the reduced-motion
 * still and the end of the fall are the same picture. Worklets: the frame
 * callback steps them on the UI thread.
 */

const GRAVITY = 3000

export type PotholePiece = {
  delay: number
  dy: number
  vy: number
  angle: number
  spin: number
  restAngle: number
  bounce: number
  squash: number
}

export const POTHOLE_PIECES = ["firstFour", "zero", "lastFour"] as const

export type PotholePieceName = (typeof POTHOLE_PIECES)[number]

export type PotholeScene = { elapsed: number; pieces: Record<PotholePieceName, PotholePiece> }

const START = {
  firstFour: { delay: 0, angle: -14, spin: 40, restAngle: 0, bounce: 0.38 },
  zero: { delay: 0.45, angle: 20, spin: -30, restAngle: -9, bounce: 0.12 },
  lastFour: { delay: 0.2, angle: 10, spin: -50, restAngle: 0, bounce: 0.38 },
} as const

// Declared before the worklets that call them: a worklet captures its closure when it is
// created, and the worklets plugin compiles these declarations without hoisting.
function atRest(piece: PotholePiece): boolean {
  "worklet"
  return (
    piece.dy === 0 &&
    piece.vy === 0 &&
    Math.abs(piece.angle - piece.restAngle) < 0.05 &&
    Math.abs(piece.spin) < 0.5 &&
    piece.squash < 0.002
  )
}

function fall(piece: PotholePiece, dt: number): void {
  "worklet"
  piece.vy += GRAVITY * dt
  piece.dy += piece.vy * dt
  piece.angle += piece.spin * dt
  if (piece.dy >= 0) {
    piece.dy = 0
    if (piece.vy > 160) {
      piece.squash = Math.min(0.22, piece.vy / 9000)
      piece.vy = -piece.vy * piece.bounce
      piece.spin *= 0.4
    } else {
      piece.vy = 0
    }
  }
  if (piece.dy >= -2) {
    piece.spin += ((piece.restAngle - piece.angle) * 160 - piece.spin * 12) * dt
  }
  piece.squash *= 1 - Math.min(1, dt * 14)
}

/** Every piece `drop` points above its rest, waiting for its delay. */
export function dropPothole(drop: number): PotholeScene {
  "worklet"
  const piece = (name: PotholePieceName): PotholePiece => ({ ...START[name], dy: -drop, vy: 0, squash: 0 })
  return { elapsed: 0, pieces: { firstFour: piece("firstFour"), zero: piece("zero"), lastFour: piece("lastFour") } }
}

/** The landed pose: the reduced-motion still, and where the fall hands over when it stops. */
export function restingPothole(): PotholeScene {
  "worklet"
  const piece = (name: PotholePieceName): PotholePiece => ({
    ...START[name],
    angle: START[name].restAngle,
    spin: 0,
    dy: 0,
    vy: 0,
    squash: 0,
  })
  return { elapsed: 0, pieces: { firstFour: piece("firstFour"), zero: piece("zero"), lastFour: piece("lastFour") } }
}

/** Advances the fall; false once every piece is at rest, and the scene is then exactly the resting pose. */
export function stepPothole(scene: PotholeScene, dt: number): boolean {
  "worklet"
  scene.elapsed += dt
  let moving = false
  for (const name of POTHOLE_PIECES) {
    const piece = scene.pieces[name]
    if (scene.elapsed >= piece.delay) fall(piece, dt)
    if (!atRest(piece)) moving = true
  }
  if (!moving) {
    for (const name of POTHOLE_PIECES) {
      const piece = scene.pieces[name]
      piece.angle = piece.restAngle
      piece.spin = 0
      piece.squash = 0
    }
  }
  return moving
}
