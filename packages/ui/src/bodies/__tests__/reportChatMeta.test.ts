/**
 * The report detail's "View chat" row reads "{members} · {messages}". i18next pluralizes on `count`
 * only, so each count is its own `_one`/`_other` key and the row joins them; a single key carrying both
 * counts can never say "1 member".
 *
 * The body imports react-native, which this package's node-environment vitest cannot load, so the call
 * site is read off the source (the house pattern) and the strings come from the real i18n instance.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createI18n } from "../../i18n/config"

const body = readFileSync(new URL("../ReportDetailBody.tsx", import.meta.url), "utf8")

function meta(lng: "en" | "es" | "de" | "ko", members: number, messages: number): string {
  const t = createI18n(lng).getFixedT(lng, "report-detail")
  return [
    t("chat.view_chat_members", { count: members }),
    t("chat.view_chat_messages", { count: messages }),
  ].join(" · ")
}

describe("report chat row counts", () => {
  it("pluralizes each count on its own key", () => {
    expect(body).toContain('t("chat.view_chat_members", { count: members })')
    expect(body).toContain('t("chat.view_chat_messages", { count: messages })')
    expect(body).not.toContain("view_chat_meta")
  })

  it.each([
    ["en", 1, 1, "1 member · 1 message"],
    ["en", 1, 0, "1 member · 0 messages"],
    ["en", 2, 1, "2 members · 1 message"],
    ["es", 1, 1, "1 miembro · 1 mensaje"],
    ["es", 1, 0, "1 miembro · 0 mensajes"],
    ["es", 2, 1, "2 miembros · 1 mensaje"],
    ["de", 1, 1, "1 Mitglied · 1 Nachricht"],
    ["de", 1, 0, "1 Mitglied · 0 Nachrichten"],
    ["de", 2, 1, "2 Mitglieder · 1 Nachricht"],
    ["ko", 1, 0, "멤버 1명 · 메시지 0개"],
    ["ko", 2, 1, "멤버 2명 · 메시지 1개"],
  ] as const)("%s: (%i, %i) reads %s", (lng, members, messages, expected) => {
    expect(meta(lng, members, messages)).toBe(expected)
  })
})
