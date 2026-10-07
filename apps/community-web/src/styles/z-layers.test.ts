import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import config from "../../tailwind.config"
import {
  Z_APP_BANNER,
  Z_BOOT_SPLASH,
  Z_FIRST_RUN_GATE,
  Z_LAYERS,
  Z_SESSION_ALERT,
  Z_TURNSTILE_CHALLENGE,
} from "./z-layers"

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url))
const RAW_Z_CLASS = /\bz-(\[|\d)/
const REACT_NATIVE_WEB_MODAL_Z = 9999

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe("z-index scale", () => {
  it("keeps every layer at its established value", () => {
    expect(Z_LAYERS).toEqual({
      "detail-header": 20,
      "console-raised": 20,
      "console-topbar": 20,
      "console-bottom-tabs": 30,
      "console-popover": 40,
      "console-bulk-bar": 40,
      "console-sheet": 50,
      "console-dialog": 60,
      "console-toast": 70,
      "console-skip-link": 80,
      "app-banner": 100,
      "first-run-gate": 200,
      "session-alert": 250,
      "boot-splash": 300,
      "turnstile-challenge": 10500,
    })
  })

  it("exports the inline-style constants from the same scale", () => {
    expect(Z_APP_BANNER).toBe(Z_LAYERS["app-banner"])
    expect(Z_FIRST_RUN_GATE).toBe(Z_LAYERS["first-run-gate"])
    expect(Z_SESSION_ALERT).toBe(Z_LAYERS["session-alert"])
    expect(Z_BOOT_SPLASH).toBe(Z_LAYERS["boot-splash"])
    expect(Z_TURNSTILE_CHALLENGE).toBe(Z_LAYERS["turnstile-challenge"])
  })

  it("stacks console layers so each can open over the one beneath it", () => {
    expect(Z_LAYERS["console-bottom-tabs"]).toBeGreaterThan(Z_LAYERS["console-topbar"])
    expect(Z_LAYERS["console-bulk-bar"]).toBeGreaterThan(Z_LAYERS["console-bottom-tabs"])
    expect(Z_LAYERS["console-sheet"]).toBeGreaterThan(Z_LAYERS["console-bulk-bar"])
    expect(Z_LAYERS["console-sheet"]).toBeGreaterThan(Z_LAYERS["console-popover"])
    expect(Z_LAYERS["console-dialog"]).toBeGreaterThan(Z_LAYERS["console-sheet"])
    expect(Z_LAYERS["console-toast"]).toBeGreaterThan(Z_LAYERS["console-dialog"])
    expect(Z_LAYERS["console-skip-link"]).toBeGreaterThan(Z_LAYERS["console-toast"])
  })

  it("keeps the session alert between the first-run gate and the boot splash", () => {
    expect(Z_SESSION_ALERT).toBeGreaterThan(Z_FIRST_RUN_GATE)
    expect(Z_SESSION_ALERT).toBeGreaterThan(Z_APP_BANNER)
    expect(Z_SESSION_ALERT).toBeLessThan(Z_BOOT_SPLASH)
    expect(Z_TURNSTILE_CHALLENGE).toBeGreaterThan(REACT_NATIVE_WEB_MODAL_Z)
  })

  it("generates one Tailwind utility per layer with the same value", () => {
    expect(config.theme?.extend?.zIndex).toEqual(
      Object.fromEntries(Object.entries(Z_LAYERS).map(([layer, z]) => [layer, String(z)])),
    )
  })

  it("leaves no raw or arbitrary z-index utility in the app source", () => {
    const offenders = sourceFiles(SRC_DIR).filter((file) =>
      RAW_Z_CLASS.test(readFileSync(file, "utf8")),
    )
    expect(offenders).toEqual([])
  })
})
