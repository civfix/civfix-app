# App Review notes — civfix (community app)

Paste the relevant section into **App Store Connect → App Review Information → Notes**
(and into the Play Console reviewer notes where the equivalent field exists).

---

## Donations to nonprofit event hosts

**Donations are collected outside the app, on the web, by the nonprofit — not by civfix, and not in-app.**

- Some events are hosted by independent US 501(c)(3) nonprofit organizations. On such an event
  (and on that organization's page) the app shows a **Donate** button.
- Tapping it opens `https://civfix.org/donate/<organization>` in an **SFSafariViewController**
  (Android: a Custom Tab) with the **address bar visible**. It is a normal web page: the reviewer can
  see the URL, read it, and dismiss it. Nothing about the donation is entered, rendered or confirmed
  inside the app itself.
- **No payment information is ever entered in the app.** Card entry happens on that web page, inside
  Stripe's own iframe. civfix's app has no payment SDK, no Apple Pay entitlement, and declares no
  payment-related privacy-manifest API.
- **The nonprofit is the merchant of record.** Funds settle directly to the organization's own Stripe
  account. civfix facilitates the payment and charges a disclosed 5% platform fee; civfix never holds
  the funds.
- The donation page carries the disclosures California Gov. Code §12599.9 requires (recipient, the
  possibility that the charity may not receive the donation, remittance timing, fees, deductibility,
  merchant of record, refund policy) before the donor can continue.
- **Nothing being funded is digital content or an in-app feature.** A donation unlocks no
  functionality, content, subscription or service in the app. It is a charitable contribution to a
  third-party nonprofit, so **IAP does not apply** (Guidelines 3.1.1 and 3.2.2(iv); Google Play's
  equivalent charitable-donation carve-out).

**Reviewer steps**

1. Open any event hosted by a verified nonprofit (or the organization page from that event).
2. Tap **Donate** → a Safari view opens on `civfix.org/donate/<organization>` with the address bar
   showing.
3. Test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. The donation is a real
   Stripe test-mode charge on the sandbox account; nothing is charged.
4. Dismiss the Safari view with **Close** to return to the app.

**If a reviewer treats the SFSafariViewController as "in-app"**, flip the app to hand donation links to
the system browser instead — no binary change and no resubmission:

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
