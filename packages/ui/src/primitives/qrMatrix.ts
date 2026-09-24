import qrcode from "qrcode-generator"

export const QR_QUIET_ZONE = 4

const QR_ERROR_CORRECTION = "M" as const

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

function qrModules(value: string): boolean[][] {
  const qr = qrcode(0, QR_ERROR_CORRECTION)
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  const rows: boolean[][] = []
  for (let row = 0; row < count; row++) {
    const cells: boolean[] = []
    for (let col = 0; col < count; col++) cells.push(qr.isDark(row, col))
    rows.push(cells)
  }
  return rows
}

/**
 * The drawable code for `value`, or null when there is nothing to draw: an empty value, or one the
 * encoder refuses (over QR capacity). The caller must show a visible fallback for null, never a blank plate.
 */
export function qrTicketPath(value: string): QrPath | null {
  if (value.length === 0) return null
  try {
    const rendered = qrPath(qrModules(value), 1, QR_QUIET_ZONE)
    return rendered.path.length > 0 ? rendered : null
  } catch {
    return null
  }
}
