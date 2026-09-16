# App Review notes — civfix (community app)

Paste the relevant section into **App Store Connect → App Review Information → Notes**
(and into the Play Console reviewer notes where the equivalent field exists).

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
system browser instead — no binary change and no resubmission:

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
