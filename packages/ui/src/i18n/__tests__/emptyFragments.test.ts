import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { createI18n } from "../config"

const LOCALES_DIR = fileURLToPath(new URL("../locales", import.meta.url))
const CHECK_SCRIPT = fileURLToPath(new URL("../../../scripts/check-i18n-keys.mjs", import.meta.url))

describe("a Korean word-order fragment that is deliberately empty", () => {
  it("renders as nothing instead of falling back to the English half of the sentence", () => {
    const i18n = createI18n("ko")
    expect(i18n.t("account-delete:verify.enterPre")).toBe("")
    expect(i18n.t("host-ticket:consent.terms_lead")).toBe("")
    expect(i18n.t("messages-list:signed_out.body_before")).toBe("")
    expect(i18n.t("onboarding-terms:label.lead")).toBe("")
    expect(i18n.t("account-delete:verify.enterPost")).not.toBe("")
  })

  it("still falls back to English for a key a locale lacks", () => {
    const i18n = createI18n("ko")
    i18n.addResource("en", "common", "only_in_en_fixture", "English")
    expect(i18n.t("common:only_in_en_fixture")).toBe("English")
  })
})

describe("i18n:check rejects an empty value nobody allowlisted", () => {
  let fixture: string | null = null

  afterEach(() => {
    if (fixture) rmSync(fixture, { recursive: true, force: true })
    fixture = null
  })

  const runCheck = (mutate?: (dir: string) => void): string => {
    fixture = mkdtempSync(join(tmpdir(), "civfix-i18n-"))
    cpSync(LOCALES_DIR, fixture, { recursive: true })
    mutate?.(fixture)
    const result = spawnSync(process.execPath, [CHECK_SCRIPT], {
      env: { ...process.env, CIVFIX_I18N_LOCALES_DIR: fixture },
      encoding: "utf8",
    })
    return result.stderr
  }

  const blank = (dir: string, file: string, key: string): void => {
    const path = join(dir, file)
    const catalog = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
    catalog[key] = ""
    writeFileSync(path, JSON.stringify(catalog))
  }

  it("accepts the four allowlisted Korean fragments", () => {
    expect(runCheck()).not.toContain("EMPTY VALUES")
  })

  it("fails on an empty value in a non-English catalog", () => {
    const stderr = runCheck((dir) => blank(dir, "es/share-post.json", "title"))
    expect(stderr).toContain("EMPTY VALUES")
    expect(stderr).toContain("es/share-post:title")
  })

  it("fails on an empty value in the English source", () => {
    const stderr = runCheck((dir) => blank(dir, "en/share-post.json", "title"))
    expect(stderr).toContain("en/share-post:title")
  })
})
