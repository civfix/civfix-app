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

test("T11: the push prompt waits for the legal update screen, from inside the data providers", () => {
  const hook = read("../src/push/usePushOnSignIn.ts")
  assert.match(hook, /import \{[^}]*\buseLegalUpdatePending\b[^}]*\} from "@civfix\/ui\/data"/)
  const body = hook.slice(hook.indexOf("export function usePushOnSignIn"))
  assert.match(body, /const legalUpdatePending = useLegalUpdatePending\(\)/)
  assert.match(body, /\}, \[status, promptPending, legalUpdatePending\]\)/)
  const effect = body.slice(body.lastIndexOf("useEffect("))
  const held = effect.indexOf(
    'if (status !== "authed" || !promptPending || legalUpdatePending) return',
  )
  assert.ok(held > 0, "the prompt waits while the legal update is pending")
  assert.ok(held < effect.indexOf("promptForNativePush()"), "before the system dialog")

  const layout = read("../app/_layout.tsx")
  const root = layout.slice(layout.indexOf("export default function RootLayout"))
  assert.doesNotMatch(root, /usePushOnSignIn\(\)/)
  const caller = /function (\w+)\(\): null \{\n {2}usePushOnSignIn\(\)\n {2}return null\n\}/.exec(
    layout,
  )
  const callerName = caller?.[1]
  assert.ok(callerName, "a component calls the hook")
  const element = root.indexOf(`<${callerName} />`)
  assert.ok(element > root.indexOf("<QueryProvider>") && element < root.indexOf("</QueryProvider>"))
  assert.ok(
    element > root.indexOf("<MobileDataProvider>") &&
      element < root.indexOf("</MobileDataProvider>"),
  )
})
