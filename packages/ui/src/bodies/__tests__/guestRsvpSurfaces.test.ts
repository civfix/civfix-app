import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const detail = strip(read("../EventDetailBody.tsx"))
const guests = strip(read("../EventGuestsBlock.tsx"))
const pill = strip(read("../../primitives/RsvpPill.tsx"))
const sheet = strip(read("../../primitives/GuestRsvpSheet.tsx"))
const modal = strip(read("../../primitives/ModalCardSheet.tsx"))

describe("RsvpPill signed-out seam", () => {
  it("diverts only when auth has RESOLVED to signed-out", () => {
    expect(pill).toContain("if (onSignedOutPress && !isAuthenticated && !isPending)")
  })

  it("still falls through to the host auth gate otherwise", () => {
    expect(pill).toContain("requireAuth(() => onToggle(going), { next: nextPath })")
  })
})

describe("EventDetailBody wiring", () => {
  it("offers the guest path only where the host can mint a Turnstile token", () => {
    expect(detail).toContain("const onSignedOutRsvp = getTurnstileToken ? openGuestRsvp : undefined")
    expect(detail).toContain("onGuestRsvp={onSignedOutRsvp}")
  })

  it("routes a signed-out SLOT tap to sign-in, and offers the guest sheet as its own line", () => {
    // A guest can never hold a claim (cleanup_guests has no user_id), so tapping a specific slot must
    // lead to an account, not to the guest sheet. The guest path survives as a separate link.
    const block = strip(read("../EventSlotsBlock.tsx"))
    expect(block).toContain("requireAuth(")
    expect(block).toContain('t("viewer.guest_link")')
    expect(block).not.toMatch(/onPress=\{onGuestRsvp\}[\s\S]{0,400}?row\.claim/)
    expect(block).toMatch(/viewerState === "signed_out" && onGuestRsvp/)
  })

  it("mounts the guest sheet once, beside the other event sheets", () => {
    expect(detail).toContain("<GuestRsvpSheet")
    expect(detail.match(/<GuestRsvpSheet/g)).toHaveLength(1)
  })

  it("shows the guest CONTACT roster only to `view_guest_contact` - the capability its endpoint needs", () => {
    expect(detail).toMatch(/\{canViewGuestContact \? \(\s*<View[^>]*>\s*<EventGuestsBlock/)
  })

  it("gives an actor with only `view_roster` the CONTACT-FREE roster instead", () => {
    expect(detail).toMatch(/\) : canViewRoster \? \(\s*<View[^>]*>\s*<EventRosterBlock/)
  })

  it("derives BOTH gates from the capability set alone, never from a role string", () => {
    expect(detail).toContain('hasHostCapability(capabilityCleanup, "view_guest_contact")')
    expect(detail).toContain('hasHostCapability(capabilityCleanup, "view_roster")')
    expect(detail).not.toMatch(/canViewGuestContact \|\| actsAsHost/)
    expect(detail).not.toMatch(/canViewRoster \|\| actsAsHost/)
  })
})

describe("GuestRsvpSheet", () => {
  it("refuses to submit an empty Turnstile token", () => {
    expect(sheet).toContain("if (token.length === 0)")
    expect(sheet).toContain('setLocalErrorKey("error.turnstile")')
  })

  it("scopes the token to the guest-rsvp action rather than reusing another surface", () => {
    expect(sheet).toContain("getTurnstileToken(GUEST_RSVP_TURNSTILE_ACTION)")
  })

  it("sends the honeypot as an accepted-and-flagged field, never omits it", () => {
    expect(sheet).toContain('website: ""')
  })

  it("offers the SMS channel only when the session advertises it", () => {
    expect(sheet).toContain("guestSmsEnabled === true ? (")
  })

  it("always shows the SMS consent disclosure on the SMS branch", () => {
    expect(sheet).toContain('t("form.sms_consent")')
  })

  it("flips the channel back to email when the server refuses SMS", () => {
    expect(sheet).toContain("setSmsBlocked(true)")
    expect(sheet).toContain('setForm((prev) => ({ ...prev, channel: "email", phone: "" }))')
  })

  it("resets on BOTH the open and the close transition, so no manageToken survives dismissal", () => {
    expect(sheet).toContain("resetRef.current()")
    expect(sheet).not.toContain("if (visible) resetRef.current()")
  })

  it("clears the other step's mutation error, so a stale refusal can never be shown", () => {
    expect(sheet).toContain("verify.reset()")
    expect(sheet).toContain("request.reset()")
  })

  it("seeds the countdown clock from the same instant the deadline is computed from", () => {
    expect(sheet).toContain("const sentAt = Date.now()")
    expect(sheet).toContain("setNowMs(sentAt)")
    expect(sheet).toContain("guestResendReadyAt(sentAt, res.resendAfterSec)")
  })

  it("uses the shared 6-digit segmented input and the shared modal scaffold", () => {
    expect(sheet).toContain("<SegmentedCodeInput")
    expect(sheet).toContain("<ModalCardSheet")
    expect(sheet).toContain("length={GUEST_RSVP_CODE_LENGTH}")
  })

  it("auto-submits with the code the input hands it, not with stale state", () => {
    expect(sheet).toContain("onComplete={runVerify}")
    expect(sheet).toContain("const runVerify = useCallback(\n    (value: string) => {")
  })

  it("blocks resend while the server-supplied cooldown is running", () => {
    expect(sheet).toContain("disabled={secondsLeft > 0 || sendPending}")
  })

  it("shows pending from the first press, through the Turnstile mint, not just the mutation", () => {
    expect(sheet).toContain("const [sendingCode, setSendingCode] = useState(false)")
    expect(sheet).toContain("const sendPending = sendingCode || request.isPending")
    expect(sheet).toContain("loading={sendPending}")
    expect(sheet).toContain("disabled={!canSubmitGuestForm(form, sendPending)}")
  })

  it("refuses a re-entrant send through a REF, so two presses in one frame cannot both mint", () => {
    expect(sheet).toContain("if (sendingRef.current) return")
    expect(sheet).toContain("sendingRef.current = true")
    expect(sheet).toContain("sendingRef.current = false")
  })

  it("settles the pending flag from the AWAITED promise, never from a detachable callback", () => {
    expect(sheet).toContain("await request.mutateAsync(")
    expect(sheet).not.toContain("request.mutate(")
    expect(sheet).toMatch(/} finally \{\s*if \(!stale\(\)\) settleSend\(\)/)
  })

  it("discards the outcome of a send the user has already moved past", () => {
    expect(sheet).toContain("const stale = () => sendSeqRef.current !== seq")
    expect(sheet).toContain("if (stale()) return")
  })

  it("discards an in-flight send on close AND on unmount, so no code is ever sent invisibly", () => {
    expect(sheet).toContain("const abortSend = useCallback(() => {\n    sendSeqRef.current += 1")
    expect(sheet).toMatch(/resetRef\.current\(\)\s*return abortSend\s*\}, \[visible, abortSend\]\)/)
    expect(sheet).toMatch(/if \(stale\(\)\) return[\s\S]*?await request\.mutateAsync/)
  })

  it("neutralizes the backdrop tap while a mint or send is in flight", () => {
    expect(sheet).toContain("backdropDismissDisabled={sendPending}")
    expect(modal).toContain("backdropDismissDisabled?: boolean")
    expect(modal).toContain("backdropDismissDisabled = false")
    expect(modal).toContain("onPress={backdropDismissDisabled ? undefined : onClose}")
    expect(modal).toContain("accessibilityState={{ disabled: backdropDismissDisabled }}")
  })

  it("keeps Escape and the explicit Cancel action live while the backdrop is neutralized", () => {
    expect(modal).toContain('event.key === "Escape"')
    expect(modal).toContain("handlersRef.current.onClose()")
    expect(modal).not.toContain("backdropDismissDisabled ? undefined : onCommit")
    expect(sheet).toContain('<SecondaryButton label={t("form.cancel")} onPress={onClose} size="sm" />')
  })
})

describe("EventGuestsBlock", () => {
  it("fetches nothing until the host expands it", () => {
    expect(guests).toContain("useCleanupGuests(cleanupId, { enabled: expanded })")
  })

  it("renders loading, error and empty states before any row", () => {
    expect(guests).toContain('t("guests.loading")')
    expect(guests).toContain('t("guests.error")')
    expect(guests).toContain('t("guests.empty")')
  })

  it("routes a scrubbed contact through i18n instead of hardcoding a glyph in the source", () => {
    expect(guests).toContain("if (value === null)")
    expect(guests).toContain('t("guests.contact_scrubbed")')
  })

  it("renders NO count when the server omitted guestCount, rather than a confident zero", () => {
    expect(guests).toContain("guestCount?: number")
    expect(guests).toContain("total === undefined ? null : (")
    expect(detail).toContain("guestCount={cleanup.guestCount}")
    expect(detail).not.toContain("cleanup.guestCount ?? 0")
  })

  it("mutes a cancelled guest instead of dropping the row", () => {
    expect(guests).toContain("guest.cancelledAt !== null")
    expect(guests).toContain("guestRowCancelled")
  })

  it("links the contact on web only", () => {
    expect(guests).toContain('Platform.OS !== "web"')
    expect(guests).toContain("mailto:")
    expect(guests).toContain("tel:")
  })
})
