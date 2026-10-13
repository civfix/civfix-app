/**
 * After a pick, only the selected language row may carry the "Selected" label. React Native Android
 * never clears a view's content description when its accessibilityLabel is removed, so if the check
 * and the empty radio reconcile into one native view, the previously selected row keeps announcing
 * "Selected". Distinct keys make React unmount the labelled view instead.
 *
 * Pinned by source grep: the body imports react-native, which this package's node-environment vitest
 * cannot load (the house pattern).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const body = readFileSync(new URL("../LanguageSettingsBody.tsx", import.meta.url), "utf8").replace(
  /\{?\/\*[\s\S]*?\*\/\}?/g,
  "",
)

describe("language picker selection indicator", () => {
  it("labels only the check, and never reuses its view for the empty radio", () => {
    expect(body).toMatch(/<View key="check" style=\{styles\.check\} accessibilityLabel=\{selectedLabel\}>/)
    expect(body).toMatch(/<View key="empty" style=\{styles\.radioEmpty\} \/>/)
  })
})
