import { readFileSync } from "node:fs"
import { AppError, ErrorCode } from "@civfix/shared"
import { describe, expect, it } from "vitest"
import {
  PROFILE_SAVE_RATE_LIMITED_KEY,
  PROFILE_SAVE_VALIDATION_KEY,
  profileSaveErrorKey,
} from "../../data/errorCode"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("Settings > Account editors map the save failure onto honest copy", () => {
  it("tells a throttled or refused save apart from a transient one", () => {
    expect(profileSaveErrorKey(new AppError(ErrorCode.RATE_LIMITED, "slow"), "bio.error.generic")).toBe(
      PROFILE_SAVE_RATE_LIMITED_KEY,
    )
    expect(profileSaveErrorKey(new AppError(ErrorCode.VALIDATION, "no"), "bio.error.generic")).toBe(
      PROFILE_SAVE_VALIDATION_KEY,
    )
    expect(profileSaveErrorKey(new AppError(ErrorCode.INTERNAL, "boom"), "bio.error.generic")).toBe(
      "bio.error.generic",
    )
    expect(profileSaveErrorKey(new Error("offline"), "bio.error.generic")).toBe("bio.error.generic")
  })

  it("lets an editor name its own refusal copy", () => {
    expect(
      profileSaveErrorKey(
        new AppError(ErrorCode.VALIDATION, "no"),
        "social.error.save",
        "social.error.invalid",
      ),
    ).toBe("social.error.invalid")
  })

  it.each([
    ["../settings/BioEditor.tsx", 'profileSaveErrorKey(err, "bio.error.generic")'],
    ["../settings/DisplayNameEditor.tsx", 'profileSaveErrorKey(err, "name.error.generic")'],
    ["../settings/DonationLinkEditor.tsx", 'profileSaveErrorKey(err, "editor.error")'],
    [
      "../settings/SocialLinksEditor.tsx",
      'profileSaveErrorKey(err, "social.error.save", "social.error.invalid")',
    ],
  ])("%s routes its catch through the mapper", (rel, call) => {
    const src = read(rel)
    expect(src).toContain(call)
    expect(src).not.toMatch(/\.catch\(\(\) => setSubmitError/)
  })
})

describe("settings switches and links never fail silently", () => {
  it("toasts when a privacy switch fails to save", () => {
    const src = read("../SettingsPrivacyBody.tsx")
    expect(src).toContain('onError: () => toast.show(t("save_error"), { variant: "error" })')
    expect(src).not.toContain("updatePrivacy.mutate(next) }")
    expect(src).toContain("onValueChange: (next) => savePrivacy(next)")
  })

  it("toasts when a notification switch fails to save", () => {
    const src = read("../NotificationPrefsBody.tsx")
    expect(src).toContain("update.mutate({ push: next }, { onError: onSaveError })")
    expect(src).toContain("update.mutate({ [key]: next }, { onError: onSaveError })")
  })

  it("handles an About link that rejects or has no host capability", () => {
    const src = read("../SettingsBody.tsx")
    expect(src).toContain("openExternal.open(url).catch(showOpenError)")
    expect(src).toMatch(/if \(!openExternal\) \{\s*showOpenError\(\)/)
    expect(src).not.toContain("void openExternal?.open(url)")
  })
})

describe("Settings > Account avatar and data export", () => {
  const src = read("../SettingsAccountBody.tsx")

  it("shows the uploading state only after a photo is picked, guarded against a second picker", () => {
    const pick = src.indexOf("await camera.pickFromLibrary()")
    const uploading = src.indexOf("setAvatarUploading(true)")
    expect(pick).toBeGreaterThan(-1)
    expect(uploading).toBeGreaterThan(pick)
    expect(src).toContain("if (!profile || avatarBusyRef.current) return")
    expect(src).toContain("avatarBusyRef.current = false")
  })

  it("announces the export outcome from the request, so a language switch does not re-announce", () => {
    expect(src).toMatch(/requestMyData\.mutate\(undefined, \{\s*onSuccess:/)
    expect(src).not.toContain("[requestMyData.status, requestMyData.data, t]")
  })

  it("inks the export failure note with the AA danger token", () => {
    expect(src).toMatch(/dataNoteWarnText: \{\s*color: t\.colors\.dangerInk,/)
  })
})

describe("delete-account dialog", () => {
  const src = read("../DeleteAccountModal.tsx")

  it("focuses the code field from an effect that cancels its timer on close or unmount", () => {
    expect(src).not.toMatch(/onSuccess: \(\) => \{[\s\S]{0,120}setTimeout\(/)
    expect(src).toContain("setCodeFocusRequest((n) => n + 1)")
    expect(src).toMatch(/if \(!visible \|\| codeFocusRequest === 0\) return[\s\S]{0,120}return \(\) => clearTimeout\(timer\)/)
  })

  it("inks every warning line with the AA danger token", () => {
    expect(src).toMatch(/warnText: \{[\s\S]{0,160}color: t\.colors\.dangerInk,/)
    expect(src).toMatch(/warnStrong: \{[\s\S]{0,80}color: t\.colors\.dangerInk,/)
    expect(src).toMatch(/warnSub: \{[\s\S]{0,160}color: t\.colors\.dangerInk,/)
    expect(src).not.toMatch(/color: t\.colors\.bloom\["(600|700)"\]/)
  })

  it("gives Resend a 44pt target and exposes its in-flight state", () => {
    expect(src).toMatch(/resend: \{\s*alignSelf: "flex-start",\s*minHeight: 44,/)
    expect(src).toContain(
      "accessibilityState={{ disabled: requestCode.isPending, busy: requestCode.isPending }}",
    )
  })
})

describe("settings radio rows", () => {
  it("announces the language row as checked on native and web", () => {
    const src = read("../LanguageSettingsBody.tsx")
    expect(src).toContain("accessibilityState={{ checked: selected }}")
    expect(src).toContain("aria-checked={selected}")
    expect(src).not.toContain("accessibilityState={{ selected }}")
  })

  it.each([
    "../LanguageSettingsBody.tsx",
    "../AppearanceOptionList.tsx",
    "../settings/PrimaryOrganizationPicker.tsx",
  ])("%s puts no label on the decorative check slot", (rel) => {
    expect(read(rel)).not.toContain("selectedLabel")
  })
})
