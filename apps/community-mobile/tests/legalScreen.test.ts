import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const routeUrl = new URL("../app/legal/[type].tsx", import.meta.url)

// The screen's behaviour (the document, its back control, loading, error and retry) is LegalDocumentScreen's,
// tested in @civfix/ui; node cannot render a route, so these pin what the route and the gates wire up.
test("T15: /legal/<type> renders the shared legal screen with a back control", () => {
  assert.ok(existsSync(routeUrl), "app/legal/[type].tsx")
  const route = read("../app/legal/[type].tsx")
  assert.match(route, /useLocalSearchParams<\{ type\?: string \| string\[\] \}>\(\)/)
  assert.match(route, /const documentType = legalDocumentTypeOf\(type\)/)
  assert.match(route, /<LegalDocumentScreen type=\{documentType\} onBack=\{back\} \/>/)
  assert.match(route, /if \(router\.canGoBack\(\)\) router\.back\(\)\n\s+else router\.replace\("\/"\)/)
  assert.doesNotMatch(route, /DeepLinkHost/)
})

test("T16: a type the app doesn't know renders the app's not-found screen", () => {
  const route = read("../app/legal/[type].tsx")
  assert.match(route, /import NotFoundScreen from "\.\.\/\+not-found"/)
  assert.match(route, /if \(documentType === null\) return <NotFoundScreen \/>/)
})

test("T17, T18: the app presents a legal document by pushing its in-app screen", () => {
  const bridges = read("../src/boot/AppBridges.tsx")
  assert.match(bridges, /setLegalDocumentPresenter\(\(type\) => router\.push\(`\/legal\/\$\{type\}`\)\)/)
  assert.match(bridges, /return \(\) => setLegalDocumentPresenter\(null\)/)
  assert.match(bridges, /<LegalDocumentBridge \/>/)
})

test("T18: the onboarding ready page opens Terms and Privacy through the presenter, not the browser", () => {
  const page = read("../src/components/onboarding/pages/ReadyPage.tsx")
  assert.match(page, /const openLegal = useOpenLegalDocument\(\)/)
  assert.match(page, /onPress=\{\(\) => openLegal\("terms"\)\}/)
  assert.match(page, /onPress=\{\(\) => openLegal\("privacy"\)\}/)
  assert.doesNotMatch(page, /TERMS_URL|PRIVACY_URL|useOpenExternal/)
})

test("T20: both gates step aside, still mounted, while the legal screen is on top", () => {
  const hook = read("../src/hooks/useLegalScreenOnTop.ts")
  assert.match(hook, /return isLegalDocumentPath\(usePathname\(\)\)/)

  const onboarding = read("../src/components/onboarding/OnboardingGate.tsx")
  assert.match(onboarding, /const legalOnTop = useLegalScreenOnTop\(\)/)
  assert.match(onboarding, /style=\{\[styles\.overlay, overlayStyle, legalOnTop \? styles\.stepAside : null\]\}/)
  assert.match(onboarding, /stepAside: \{ display: "none" \}/)

  const firstRun = read("../src/components/FirstRunGate.tsx")
  assert.match(firstRun, /const legalOnTop = useLegalScreenOnTop\(\)/)
  assert.match(firstRun, /<View style=\{\[styles\.overlay, legalOnTop \? styles\.stepAside : null\]\}>/)
  assert.match(firstRun, /stepAside: \{ display: "none" \}/)
})

test("T20: hardware back goes to the legal screen, not the onboarding pager, while it is on top", () => {
  const onboarding = read("../src/components/onboarding/OnboardingGate.tsx")
  const effect = onboarding.slice(onboarding.indexOf("const onBackPress"))
  const guard = onboarding.slice(0, onboarding.indexOf("const onBackPress"))
  assert.match(guard, /if \(!visible \|\| legalOnTop\) return\n\s+$/)
  assert.match(effect, /\}, \[visible, legalOnTop\]\)/)
})
