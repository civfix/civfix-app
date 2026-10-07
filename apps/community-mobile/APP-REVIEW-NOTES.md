# App Review notes: civfix (community app)

Paste the relevant section into **App Store Connect → App Review Information → Notes**
(and into the Play Console reviewer notes where the equivalent field exists).

The **Environment** section below is the exception: it is an internal pre-submission checklist, not
reviewer-facing copy. Do not paste it into App Store Connect.

---

## Environment: App Review runs against STAGING (internal; do not paste)

**The binary a reviewer runs talks to `api.civfix.dev`, not `api.civfix.org`.** This is deliberate
and needs to be understood before every submission.

The `production` EAS profile bakes no `EXPO_PUBLIC_API_URL`; the app picks its API at launch from its
iOS install source. A TestFlight/beta install (`StoreKit/sandboxReceipt`) resolves to
`https://api.civfix.dev`, an App Store download (`StoreKit/receipt`) to `https://api.civfix.org`
(`src/lib/apiUrl.ts`, `src/lib/nativeBetaInstall.ts`; the mechanism is written up in `README.md`).
App Review installs through the beta/sandbox path (the same fact behind StoreKit's 21007 sandbox
receipt status), so the reviewer's copy sees a sandbox receipt and runs against **staging**.

Consequences, accepted knowingly: the approval verdict is rendered against a binary whose production
behaviour was never exercised by the reviewer, and anything the reviewer is asked to find has to exist
on staging. There is no OTA update channel in this project that could flip an override for review
only, and routing beta installs to staging is the property this app deliberately wants: testers must
never write to the live civic record.

**Pre-submission checklist (all of these are about the STAGING environment):**

- [ ] `api.civfix.dev` is up and healthy (`/readyz`), and staging is on the same commit as the build
      being submitted.
- [ ] Staging carries reviewer-visible demo content: at least one event, organization or profile
      that shows a **Donate** card, so the "Reviewer steps" under *External donation links* can
      actually be followed. Without it the reviewer finds nothing and the note reads as false.
- [ ] Staging carries a demo event with a ticket QR, so the check-in scanner note can be followed.
- [ ] A working reviewer sign-in exists on staging and the credentials in App Store Connect →
      App Review Information match it. **This is currently missing:** `REVIEWER_OTP_BYPASS` and
      `REVIEWER_OTP_CODE` are absent from `civfix-infra/secrets/staging/api.sops.env` (and from the
      prod one), so the reviewer-OTP path is fail-closed on staging today. Add both to the staging
      SOPS file and redeploy before submitting, or give the reviewer an account whose OTP they can
      actually receive.
- [ ] Share links opened from the reviewer's build point at `civfix.dev` and resolve there; iOS
      universal links are pinned to `civfix.org` only, so those links open in the browser rather than
      deep-linking back into the app. Harmless, but do not write a reviewer step that depends on a
      share link re-entering the app.

---

## External donation links

**civfix processes no payments anywhere in its stack. A donation link is a plain external URL a host
chose, and it opens in the browser.**

- An event host, an organization or a person may add a **donation link** to their own profile,
  organization or event: an https URL to a page they run elsewhere (their own fundraiser, a
  nonprofit's giving page, a payment page they own). civfix stores only the URL.
- Where such a link exists, the app shows a small **Donate** card naming who it supports and the
  link's hostname. Tapping **Open donation page** opens that URL in an **SFSafariViewController**
  (Android: a Custom Tab) with the **address bar visible**. It is an ordinary third-party web page:
  the reviewer can see the URL, read it, and dismiss it. Nothing about a donation is entered,
  rendered or confirmed inside the app.
- **No payment information is ever entered in the app, and civfix never holds or moves funds.** The
  app has no payment SDK, no Apple Pay entitlement, no checkout screen and no payment-related
  privacy-manifest API. civfix is not a party to whatever happens on the host's page.
- **Nothing being funded is digital content or an in-app feature.** A donation unlocks no
  functionality, content, subscription or service in the app, so **IAP does not apply**
  (Guidelines 3.1.1 and 3.2.2(iv); Google Play's equivalent carve-out for donations to third parties
  made outside the app).

**Reviewer steps**

1. Open an event, organization or profile that shows a **Donate** card (a host sets the link under
   Settings → Account → Donation link; an organization sets it in its web settings).
2. Tap **Open donation page** → a Safari view opens on the host's own page with the address bar
   showing the third-party hostname.
3. Dismiss the Safari view with **Close** to return to the app. No state in the app changes.

**If a reviewer objects to the SFSafariViewController**, flip the app to hand donation links to the
system browser instead, with no binary change and no resubmission:

```sh
EXPO_PUBLIC_DONATE_BROWSER_MODE=system eas update --branch production
```

(`src/config.ts` `DONATE_BROWSER_MODE`; `in-app` is the default, `system` calls `Linking.openURL`.)

---

## Event check-in QR scanner

- An event host who is running the door uses **Check in → Scan** to read the QR code on an attendee's
  ticket. It uses the camera already declared for civic reports (`NSCameraUsageDescription`); it reads
  only civfix's own ticket codes and stores nothing from the frames.
- The scan affordance is hidden entirely on devices whose build has no code scanner, so a reviewer on
  such a build sees manual code entry instead and no broken button.
