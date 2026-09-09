import { describe, expect, it } from "vitest"
import { QR_QUIET_ZONE, qrPath } from "../qrMatrix"

const grid = (rows: string[]): boolean[][] =>
  rows.map((row) => [...row].map((cell) => cell === "#"))

describe("qrPath", () => {
  it("uses the LARGER dimension as the module count, so no row is silently cropped", () => {
    expect(qrPath(grid(["###"]), 1, 0).moduleCount).toBe(3)
  })

  it("sizes the canvas as the code PLUS a quiet zone on both sides", () => {
    const { size, moduleCount } = qrPath(grid(["#.", ".#"]), 4, 4)
    expect(moduleCount).toBe(2)
    expect(size).toBe((2 + 4 * 2) * 4)
  })

  it("merges a horizontal run into ONE subpath instead of one rect per module", () => {
    const { path } = qrPath(grid(["###"]), 1, 0)
    expect(path).toBe("M0 0h3v1h-3z")
  })

  it("emits one subpath per run, so a gap actually breaks the run", () => {
    const { path } = qrPath(grid(["#.#"]), 1, 0)
    expect(path.match(/M/g)).toHaveLength(2)
  })

  it("offsets every module by the quiet zone", () => {
    const { path } = qrPath(grid(["#"]), 2, 1)
    expect(path).toBe("M2 2h2v2h-2z")
  })

  it("closes a run that reaches the right edge (no dropped last column)", () => {
    const { path } = qrPath(grid([".##"]), 1, 0)
    expect(path).toBe("M1 0h2v1h-2z")
  })

  it("returns an empty path - not a crash - for an empty matrix", () => {
    const { path, size, moduleCount } = qrPath([], 4, QR_QUIET_ZONE)
    expect(path).toBe("")
    expect(moduleCount).toBe(0)
    expect(size).toBe(QR_QUIET_ZONE * 2 * 4)
  })

  it("draws nothing for an all-light matrix", () => {
    expect(qrPath(grid(["..", ".."]), 1, 0).path).toBe("")
  })

  it("scales every coordinate by the cell size", () => {
    const { path } = qrPath(grid(["#", "#"]), 3, 0)
    expect(path).toBe("M0 0h3v3h-3zM0 3h3v3h-3z")
  })
})
