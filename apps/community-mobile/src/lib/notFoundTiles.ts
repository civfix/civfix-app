/**
 * The 404's tumbling tiles (variant A), ported from community-web's
 * `stage-tiles.tsx`. Every function here runs as a worklet on the UI thread:
 * the frame callback steps the bodies and the stage's pan gesture grabs and
 * throws them, so a throw never waits on the JS thread.
 */

const GRAVITY = 2600
const BOUNCE = 0.42
const TILE_BOUNCE = 0.3
const AIR_DRAG = 0.4
const FLOOR_FRICTION = 6
const MAX_FLING = 2800

export type TileBody = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  grabbed: boolean
  grabDx: number
  grabDy: number
}

/** The stage's size and the tile's edge, in points; the floor is the stage's bottom edge. */
export type TileBox = { width: number; height: number; tile: number }

export const TILE_COUNT = 3

/** Staggered heights and tilts above the stage, so the tiles land one after another, not as a block. */
export function dropTiles(box: TileBox): TileBody[] {
  "worklet"
  const gap = box.tile * 0.14
  const rowStart = box.width / 2 - box.tile * 1.5 - gap
  const angles = [-18, 12, -8]
  const spins = [90, -140, 60]
  const bodies: TileBody[] = []
  for (let i = 0; i < TILE_COUNT; i++) {
    bodies.push({
      x: rowStart + box.tile / 2 + i * (box.tile + gap),
      y: -box.tile * (0.8 + i * 0.9),
      vx: 0,
      vy: 0,
      angle: angles[i] ?? 0,
      spin: spins[i] ?? 0,
      grabbed: false,
      grabDx: 0,
      grabDy: 0,
    })
  }
  return bodies
}

/** The topmost tile under a point, honouring each tile's tilt; -1 when the point misses them all. */
export function tileAt(bodies: readonly TileBody[], tile: number, x: number, y: number): number {
  "worklet"
  const half = tile / 2
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i]!
    const rad = (-b.angle * Math.PI) / 180
    const dx = x - b.x
    const dy = y - b.y
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
    if (Math.abs(lx) <= half && Math.abs(ly) <= half) return i
  }
  return -1
}

export function grabTile(b: TileBody, x: number, y: number): void {
  "worklet"
  b.grabbed = true
  b.grabDx = b.x - x
  b.grabDy = b.y - y
  b.vx = 0
  b.vy = 0
}

export function dragTile(b: TileBody, x: number, y: number, vx: number, vy: number): void {
  "worklet"
  b.x = x + b.grabDx
  b.y = y + b.grabDy
  b.vx = vx
  b.vy = vy
}

export function releaseTile(b: TileBody): void {
  "worklet"
  b.grabbed = false
  const speed = Math.hypot(b.vx, b.vy)
  if (speed > MAX_FLING) {
    b.vx *= MAX_FLING / speed
    b.vy *= MAX_FLING / speed
  }
  b.spin += b.vx * 0.15
}

export function stepTiles(bodies: TileBody[], box: TileBox, dt: number): void {
  "worklet"
  const half = box.tile / 2
  const floor = box.height - half
  for (const b of bodies) {
    if (b.grabbed) {
      b.angle += (b.vx * 0.012 - b.angle) * Math.min(1, dt * 10)
      continue
    }
    b.vy += GRAVITY * dt
    b.vx *= 1 - AIR_DRAG * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.angle += b.spin * dt

    const grounded = b.y >= floor - 0.5
    if (b.y > floor) {
      b.y = floor
      b.vy = Math.abs(b.vy) > 120 ? -b.vy * BOUNCE : 0
      b.spin = b.spin * 0.5 + b.vx * 0.2
    }
    if (b.x < half || b.x > box.width - half) {
      b.x = Math.min(Math.max(b.x, half), box.width - half)
      b.vx = -b.vx * BOUNCE
      b.spin -= b.vy * 0.1
    }
    if (b.y < half - box.tile * 4) b.vy = Math.max(b.vy, 0)
    if (grounded) {
      // Grounded tiles right themselves, so a thrown tile settles upright.
      const target = Math.round(b.angle / 360) * 360
      b.spin += ((target - b.angle) * 120 - b.spin * 14) * dt
      b.vx *= 1 - Math.min(1, FLOOR_FRICTION * dt)
    } else {
      b.spin *= 1 - 0.6 * dt
    }
  }

  const minDist = box.tile * 0.98
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!
      const b = bodies[j]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      if (dist >= minDist) continue
      // A narrowing stage clamps tiles onto the same wall spot, where the centre
      // line has no direction; split them sideways in reading order instead.
      const nx = dist > 0 ? dx / dist : 1
      const ny = dist > 0 ? dy / dist : 0
      const overlap = minDist - dist
      const aShare = a.grabbed ? 0 : b.grabbed ? 1 : 0.5
      const bShare = 1 - aShare
      a.x -= nx * overlap * aShare
      a.y -= ny * overlap * aShare
      b.x += nx * overlap * bShare
      b.y += ny * overlap * bShare
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (rel < 0) {
        const impulse = -(1 + TILE_BOUNCE) * rel
        if (!a.grabbed) {
          a.vx -= nx * impulse * aShare
          a.vy -= ny * impulse * aShare
          a.spin -= impulse * 0.08
        }
        if (!b.grabbed) {
          b.vx += nx * impulse * bShare
          b.vy += ny * impulse * bShare
          b.spin += impulse * 0.08
        }
      }
    }
  }
  for (const b of bodies) {
    if (!b.grabbed && b.y > floor) b.y = floor
  }
}
