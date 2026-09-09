export const QR_QUIET_ZONE = 4

export const QR_ERROR_CORRECTION = "M" as const

export interface QrPath {
  path: string
  size: number
  moduleCount: number
}

export function qrPath(
  modules: readonly (readonly boolean[])[],
  cellSize: number,
  quietZone: number = QR_QUIET_ZONE,
): QrPath {
  const rowCount = modules.length
  let columnCount = 0
  for (const row of modules) columnCount = Math.max(columnCount, row.length)
  const moduleCount = Math.max(rowCount, columnCount)
  const size = (moduleCount + quietZone * 2) * cellSize
  if (moduleCount === 0) return { path: "", size, moduleCount }

  const segments: string[] = []
  for (let row = 0; row < rowCount; row++) {
    const cells = modules[row]
    if (!cells) continue
    let runStart = -1
    for (let col = 0; col <= cells.length; col++) {
      const dark = col < cells.length && cells[col] === true
      if (dark && runStart === -1) runStart = col
      if (!dark && runStart !== -1) {
        const x = (runStart + quietZone) * cellSize
        const y = (row + quietZone) * cellSize
        const w = (col - runStart) * cellSize
        segments.push(`M${x} ${y}h${w}v${cellSize}h${-w}z`)
        runStart = -1
      }
    }
  }
  return { path: segments.join(""), size, moduleCount }
}
