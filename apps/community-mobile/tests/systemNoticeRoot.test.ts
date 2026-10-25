import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const forceUpdate = readFileSync(new URL("../src/components/ForceUpdateGate.tsx", import.meta.url), "utf8")
const SHELL = "../../../packages/ui/src/shell/"
const noticeSources = ["SystemNoticeFrame.tsx", "SystemNoticeBanner.native.tsx", "SystemNoticeBanner.shared.tsx"].map(
  (file) => [file, readFileSync(new URL(SHELL + file, import.meta.url), "utf8")] as const,
)

function layers(src: string, prop: "zIndex" | "elevation"): number[] {
  return [...src.matchAll(new RegExp(`\\b${prop}:\\s*(\\d+)`, "g"))].map((m) => Number(m[1]))
}

test("T24: the force-update screen stays above the system notice", () => {
  assert.match(layout, /import \{[^}]*\bSystemNoticeFrame\b[^}]*\} from "@civfix\/ui"/)
  const open = layout.indexOf("<SystemNoticeFrame>")
  const close = layout.indexOf("</SystemNoticeFrame>")
  const gate = layout.indexOf("<ForceUpdateGate />")
  assert.ok(open > -1 && close > open, "the root mounts the notice frame around the app")
  assert.ok(gate > close, "the force-update gate is a later sibling, outside the frame")

  assert.deepEqual(layers(forceUpdate, "zIndex"), [70])
  assert.deepEqual(layers(forceUpdate, "elevation"), [70])
  for (const [file, src] of noticeSources) {
    for (const value of [...layers(src, "zIndex"), ...layers(src, "elevation")]) {
      assert.ok(value < 70, `${file} stacks at ${value}, at or above the force-update screen`)
    }
  }
})
