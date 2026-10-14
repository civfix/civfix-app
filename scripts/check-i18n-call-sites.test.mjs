import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-i18n-call-sites.mjs")
const roots = []

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "i18n-call-sites-"))
  roots.push(root)
  const tree = {
    "packages/ui/src/i18n/locales/en/common.json": JSON.stringify({ save: "Save" }),
    "packages/ui/src/i18n/locales/en/events.json": JSON.stringify({
      title: "Events",
      count_one: "{{count}} event",
      count_other: "{{count}} events",
      steps: { first: "One" },
    }),
    "apps/community-web/src/.keep": "",
    "apps/community-mobile/app/.keep": "",
    "apps/community-mobile/src/.keep": "",
    ...files,
  }
  for (const [path, body] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

function run(root) {
  return spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, I18N_CALL_SITES_ROOT: root }, encoding: "utf8" })
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

test("passes when every literal key resolves in its bound namespace, plural base keys included", () => {
  const root = fixture({
    "packages/ui/src/A.tsx": 'const { t } = useT("events")\nt("title")\nt("count", { count: 2 })\nconst c = useT()\nc.t("save")\n',
  })
  const result = run(root)
  assert.equal(result.status, 0, result.stderr)
})

test("fails on a key that only exists in another namespace, and names where it lives", () => {
  const root = fixture({ "apps/community-web/src/B.tsx": 'const { t } = useT("events")\nt("save")\n' })
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /not in namespace events; it exists in common/)
})

test("fails on a missing key and on an unknown namespace prefix", () => {
  const root = fixture({ "apps/community-mobile/src/C.tsx": 'const { t } = useT("events")\nt("nope")\nt("ghost:title")\n' })
  const result = run(root)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /t\("nope"\): not in namespace events, nor any en catalog/)
  assert.match(result.stderr, /namespace "ghost" has no en catalog/)
})

test("fails on an object key read without returnObjects, and accepts it with returnObjects", () => {
  const bad = fixture({ "packages/ui/src/D.tsx": 'const { t } = useT("events")\nt("steps")\n' })
  assert.match(run(bad).stderr, /names an object, not a string/)
  const good = fixture({ "packages/ui/src/E.tsx": 'const { t } = useT("events")\nt("steps", { returnObjects: true })\n' })
  assert.equal(run(good).status, 0)
})

test("skips dynamic template keys", () => {
  const root = fixture({ "packages/ui/src/F.tsx": 'const { t } = useT("events")\nt(`steps.${step}`)\n' })
  assert.equal(run(root).status, 0)
})
