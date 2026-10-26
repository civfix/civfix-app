import { test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { ESLint, type Linter } from "eslint"

const APP_DIR = fileURLToPath(new URL("..", import.meta.url))
const BANNED = ["currentVersion", "legalDocument", "isCurrent", "currentLegalVersion", "LEGAL_DOCUMENTS"]
const SOURCES = ["@civfix/contract/legal", "@civfix/contract"]

// Only `no-restricted-imports` is under test. The file below doesn't exist, which the type-aware project
// service refuses, so parsing runs without types and every other rule the file resolves to is off.
async function restrictedImports(filePath: string, code: string): Promise<Linter.LintMessage[]> {
  const config = (await new ESLint({ cwd: APP_DIR }).calculateConfigForFile(filePath)) as Linter.Config
  const others = Object.keys(config.rules ?? {}).filter((rule) => rule !== "no-restricted-imports")
  const eslint = new ESLint({
    cwd: APP_DIR,
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false, project: false } },
      rules: Object.fromEntries(others.map((rule) => [rule, "off"])),
    },
  })
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).filter((message) => message.ruleId === "no-restricted-imports")
}

test("T30: src/x.ts may import none of the backend-only legal helpers", async () => {
  for (const source of SOURCES) {
    for (const name of BANNED) {
      const errors = await restrictedImports("src/x.ts", `import { ${name} } from "${source}"\n`)
      assert.equal(errors.length, 1, `${name} from ${source}`)
    }
  }
})
