import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const EDITORS = [
  "../settings/DisplayNameEditor.tsx",
  "../settings/BioEditor.tsx",
  "../settings/ChangeUsernameEditor.tsx",
  "../settings/SocialLinksEditor.tsx",
  "../settings/DonationLinkEditor.tsx",
]

describe("every Settings > Account editor is a row that opens a modal", () => {
  it.each(EDITORS)("%s renders a SettingsRow and edits inside ModalCardSheet", (rel) => {
    const src = read(rel)
    expect(src).toContain("<SettingsRow")
    expect(src).toContain("<ModalCardSheet")
    expect(src).toContain("visible={editing}")
    expect(src).toContain("onClose={cancel}")
    expect(src).toContain("onCommit={save}")
  })

  it.each(EDITORS)("%s takes the house dialog buttons, not hand-rolled Pressables", (rel) => {
    const src = read(rel)
    expect(src).toContain("<SecondaryButton")
    expect(src).toContain("<PrimaryButton")
    expect(src).toContain("loading={saving}")
    expect(src).toContain("disabled={!canSave}")
    expect(src).not.toContain("ActivityIndicator")
  })

  it.each(EDITORS)("%s surfaces the mapped submit error in the dialog's error slot", (rel) => {
    const src = read(rel)
    expect(src).toContain("error={submitError}")
    expect(src).toContain("dismissLabel=")
  })

  it.each(EDITORS)("%s keeps its fields uneditable while a save is in flight", (rel) => {
    expect(read(rel)).toContain("editable={!saving}")
  })

  it("gates Save on validity AND on a real change, per editor", () => {
    expect(read("../settings/DisplayNameEditor.tsx")).toContain(
      "const canSave = !saving && valid && !unchanged",
    )
    expect(read("../settings/BioEditor.tsx")).toContain(
      "const canSave = !saving && valid && !unchanged",
    )
    expect(read("../settings/ChangeUsernameEditor.tsx")).toMatch(
      /const canSave =\s*!saving && valid && !unchanged && !checking && \(availability\.data\?\.available \?\? false\)/,
    )
    const social = read("../settings/SocialLinksEditor.tsx")
    expect(social).toContain("const canSave = !saving && dirty")
    expect(social).toContain("SocialLinksSchema.safeParse(normalizedLinks(drafts))")
    const donation = read("../settings/DonationLinkEditor.tsx")
    expect(donation).toContain("const canSave = !saving && valid && dirty")
    expect(donation).toContain("donationLinkFieldError(draft)")
  })

  it("clears the donation link to NULL when it is emptied or removed, matching UpdateProfileRequest", () => {
    const donation = read("../settings/DonationLinkEditor.tsx")
    expect(donation).toContain("commit(normalizeDonationLink(draft))")
    expect(donation).toContain("commit(null)")
    expect(read("../SettingsAccountBody.tsx")).toContain("donationUrl,")
  })

  it("keeps the handle cooldown a DISABLED ROW - a locked field has no dialog to open", () => {
    const src = read("../settings/ChangeUsernameEditor.tsx")
    const locked = src.slice(src.indexOf("if (locked) {"), src.indexOf("return (\n    <>"))
    expect(locked).toContain("<SettingsRow")
    expect(locked).toContain("disabled")
    expect(locked).toContain('t("handle.cooldown_locked"')
    expect(locked).not.toContain("ModalCardSheet")
  })

  it("caps the bio at the contract's own maximum rather than a re-typed 500", () => {
    const src = read("../settings/BioEditor.tsx")
    expect(src).toContain('import { MAX_BIO_LENGTH } from "@civfix/shared"')
    expect(src).toContain("maxLength={MAX_BIO_LENGTH}")
    expect(src).toContain('t("bio.count", { current: draft.length, max: MAX_BIO_LENGTH })')
    expect(src).toContain("bio: string")
  })

  it("clears the bio to NULL when it is emptied, matching UpdateProfileRequest", () => {
    expect(read("../SettingsAccountBody.tsx")).toContain("bio: bio.length > 0 ? bio : null")
  })

  it("mounts all five editors in the identity section", () => {
    const account = read("../SettingsAccountBody.tsx")
    for (const tag of [
      "<DisplayNameEditor",
      "<BioEditor",
      "<ChangeUsernameEditor",
      "<SocialLinksEditor",
      "<DonationLinkEditor",
    ]) {
      expect(account).toContain(tag)
    }
  })
})

describe("the cross-fading Collapsible primitive", () => {
  it("is gone from the package, primitive and barrel alike", () => {
    const primitives = readdirSync(new URL("../../primitives/", import.meta.url))
    expect(primitives.filter((name) => name.startsWith("Collapsible"))).toEqual([])
    expect(read("../../primitives/index.ts")).not.toContain("Collapsible")
    for (const rel of EDITORS) expect(read(rel)).not.toContain("Collapsible")
  })
})

describe("the profile is display-only - the bio is edited in Settings > Account", () => {
  const VIEW = read("../ProfileView.tsx")
  const BODY = read("../ProfileBody.tsx")

  it("renders the bio TEXT and nothing else - no edit link, no empty prompt", () => {
    expect(VIEW).toContain("{profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}")
    expect(VIEW).not.toContain("EditableBio")
    expect(VIEW).not.toContain("bioEmpty")
    expect(VIEW).not.toContain("empty_prompt")
    expect(VIEW).not.toMatch(/bioEdit|bioSave|bioCancel|bioCount|bioBlock|bioActions|bioBtn/)
  })

  it("takes no bio-editing props from the host", () => {
    expect(VIEW).not.toMatch(/editableBio|onSaveBio|bioSaving/)
    expect(BODY).not.toMatch(/editableBio|onSaveBio|bioSaving/)
  })

  it("leaves no orphaned bio copy in any of the four profile-view catalogs", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(
        readFileSync(new URL(`../../i18n/locales/${lng}/profile-view.json`, import.meta.url), "utf8"),
      ) as Record<string, unknown>
      expect(catalog.bio, `${lng}/profile-view still carries the bio editor copy`).toBeUndefined()
      const account = JSON.parse(
        readFileSync(
          new URL(`../../i18n/locales/${lng}/settings-account.json`, import.meta.url),
          "utf8",
        ),
      ) as Record<string, Record<string, unknown>>
      expect(account.bio?.label, `${lng}/settings-account is missing the bio editor copy`).toBeTruthy()
    }
  })
})

describe("the page-level reassurance footers are gone", () => {
  it.each(["../SettingsPrivacyBody.tsx", "../NotificationPrefsBody.tsx"])(
    "%s renders no trailing note",
    (rel) => {
      const src = read(rel)
      expect(src).not.toContain('t("note")')
      expect(src).not.toMatch(/\n {2}note: \{/)
    },
  )

  it("keeps the per-toggle helper copy, which is not reassurance but disclosure", () => {
    const src = read("../SettingsPrivacyBody.tsx")
    expect(src).toContain('sub={t("showHours.helper")}')
    expect(src).toContain('sub={t("allowDms.helper")}')
  })

  it("drops the footer strings from all four catalogs", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      for (const ns of ["settings-privacy", "notifications-prefs"]) {
        const catalog = JSON.parse(
          readFileSync(new URL(`../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"),
        ) as Record<string, unknown>
        expect(catalog.note, `${lng}/${ns} still carries the footer`).toBeUndefined()
      }
    }
  })
})
