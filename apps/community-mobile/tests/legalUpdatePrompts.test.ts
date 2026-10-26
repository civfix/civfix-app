import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

test("T10: the home screen holds the location prompt on the shared legal update signal", () => {
  const home = read("../app/index.tsx")
  assert.match(home, /import \{[^}]*\buseLegalUpdatePending\b[^}]*\} from "@civfix\/ui\/data"/)
  assert.match(home, /const legalUpdatePending = useLegalUpdatePending\(\)/)
  const decision = home.slice(home.indexOf("locationPrimerDecision({"))
  assert.match(decision.slice(0, decision.indexOf("})")), /^\s+legalUpdatePending,$/m)
})

test("T11: push registration waits for the legal update screen, from inside the data providers", () => {
  const hook = read("../src/push/usePushOnSignIn.ts")
  assert.match(hook, /import \{[^}]*\buseLegalUpdatePending\b[^}]*\} from "@civfix\/ui\/data"/)
  const body = hook.slice(hook.indexOf("export function usePushOnSignIn"))
  assert.match(body, /const legalUpdatePending = useLegalUpdatePending\(\)/)
  assert.match(body, /\}, \[status, legalUpdatePending\]\)/)
  const effect = body.slice(body.indexOf("useEffect("))
  const held = effect.indexOf("if (legalUpdatePending) return")
  assert.ok(held > 0, "the effect returns while the legal update is pending")
  assert.ok(held < effect.indexOf("\n    attempt()"), "before the first attempt")
  assert.ok(held < effect.indexOf("AppState.addEventListener"), "before the foreground listener")

  const layout = read("../app/_layout.tsx")
  const root = layout.slice(layout.indexOf("export default function RootLayout"))
  assert.doesNotMatch(root, /usePushOnSignIn\(\)/)
  const caller = /function (\w+)\(\): null \{\n {2}usePushOnSignIn\(\)\n {2}return null\n\}/.exec(layout)
  assert.ok(caller, "a component calls the hook")
  const element = root.indexOf(`<${caller[1]} />`)
  assert.ok(element > root.indexOf("<QueryProvider>") && element < root.indexOf("</QueryProvider>"))
  assert.ok(element > root.indexOf("<MobileDataProvider>") && element < root.indexOf("</MobileDataProvider>"))
})
