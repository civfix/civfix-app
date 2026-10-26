import { fileURLToPath } from "node:url"
import { ESLint, type Linter } from "eslint"
import { describe, expect, it } from "vitest"

const APP_DIR = fileURLToPath(new URL("../..", import.meta.url))
const BANNED = ["currentVersion", "legalDocument", "isCurrent", "currentLegalVersion", "LEGAL_DOCUMENTS"]
const SOURCES = ["@civfix/contract/legal", "@civfix/contract"]

// Only `no-restricted-imports` is under test. The files below don't exist, which the type-aware project
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

describe("the legal helpers are backend only", () => {
  // The host console's own no-restricted-imports block replaces the features one for its files.
  it.each(["src/features/x.ts", "src/features/host/x.tsx"])("T30: %s may import none of them", async (file) => {
    for (const source of SOURCES) {
      for (const name of BANNED) {
        const errors = await restrictedImports(file, `import { ${name} } from "${source}"\n`)
        expect(errors.map((error) => error.message), `${name} from ${source}`).toHaveLength(1)
      }
    }
  }, 60_000)

  it("T31: the legal pages keep theirs until #240 moves them to the API", async () => {
    const errors = await restrictedImports(
      "src/components/legal/x.tsx",
      'import { legalDocument } from "@civfix/contract/legal"\n',
    )
    expect(errors).toEqual([])
  }, 60_000)
})
