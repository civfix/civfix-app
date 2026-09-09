import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Cookies & Storage · civfix",
  description:
    "The small set of strictly-necessary cookies and local storage civfix uses, and why we show no consent banner.",
}

interface StorageRow {
  item: string
  where: string
  purpose: string
  classification: string
}

const WEB_ROWS: StorageRow[] = [
  {
    item: "Session cookie",
    where: "HTTP cookie (httpOnly, Secure)",
    purpose: "Keeps you signed in. The cookie is httpOnly, so scripts cannot read it.",
    classification: "Strictly necessary (authentication)",
  },
  {
    item: "CSRF token",
    where: "In-memory (held in the running app, not persisted)",
    purpose:
      "A per-session anti-forgery token echoed on write requests to protect your account. It is discarded when you close the tab.",
    classification: "Strictly necessary (security)",
  },
  {
    item: "civfix.auth.snapshot.v1",
    where: "Browser localStorage",
    purpose:
      "A small cosmetic cache of your own profile (name, avatar) so the app can render your signed-in state instantly on reload instead of flashing a logged-out shell.",
    classification: "Strictly necessary / first-party preference",
  },
  {
    item: "__stripe_mid",
    where: "HTTP cookie set by Stripe, only on /donate/*",
    purpose:
      "Stripe's fraud-prevention device identifier. It is set only while you are on a donation page, so that Stripe can tell a returning legitimate donor from a card-testing bot. Expires after 1 year.",
    classification: "Strictly necessary (payment fraud prevention)",
  },
  {
    item: "__stripe_sid",
    where: "HTTP cookie set by Stripe, only on /donate/*",
    purpose:
      "Stripe's per-session fraud-prevention identifier for the same purpose as __stripe_mid. Expires after 30 minutes.",
    classification: "Strictly necessary (payment fraud prevention)",
  },
  {
    item: "civfix.donate.status.<id>",
    where: "Browser sessionStorage, only on /donate/*",
    purpose:
      "The short-lived capability token that lets the confirmation page read the status of the donation you just made, kept so a page reload does not lose your receipt confirmation. Cleared when you close the tab.",
    classification: "Strictly necessary (donation confirmation)",
  },
  {
    item: "Map layer toggles",
    where: "Browser localStorage",
    purpose:
      "Remembers which map layers you turned on or off so the map looks the way you left it next time.",
    classification: "First-party user-interface preference",
  },
]

const MOBILE_ROWS: StorageRow[] = [
  {
    item: "Authentication token",
    where: "Device secure storage (iOS Keychain / Android Keystore, via SecureStore)",
    purpose: "Keeps you signed in on the mobile app, stored in the operating system's secure store.",
    classification: "Strictly necessary (authentication)",
  },
  {
    item: "App preferences (e.g. map layer toggles)",
    where: "On-device key-value storage (MMKV)",
    purpose: "Remembers your interface preferences, such as which map layers you last had on.",
    classification: "First-party user-interface preference",
  },
]

export default function CookiesPage() {
  return (
    <LegalPage
      active="cookies"
      title="Cookies & Storage"
      intro="The little we store on your device, and why there's no banner"
    >
      <section>
        <h2>1. The short version</h2>
        <p>
          civfix uses only a small set of <strong>strictly necessary</strong> cookies and local storage
          needed to sign you in, keep your account secure, and remember a couple of interface
          preferences. We do <strong>not</strong> use any advertising, analytics, or cross-site tracking
          technology; we set no third-party tracking cookies; and we do not sell or share your information
          for advertising.
        </p>
        <p>
          There is exactly one third-party script anywhere in civfix, and it runs on exactly one page:
          Stripe.js on the donation page, which sets two strictly necessary fraud-prevention cookies for
          the payment you are making. Section 4 explains what they are, why they are necessary, and the
          measures that keep them off every other page.
        </p>
        <p>
          Because everything we store is either strictly necessary or a first-party preference you set
          yourself - the categories that privacy and &ldquo;cookie&rdquo; laws exempt from consent -{" "}
          <strong>civfix does not show a cookie consent banner</strong>. There is nothing non-essential to
          consent to. This holds for visitors in the European Economic Area and the United Kingdom as
          well: under the EU ePrivacy rules and the UK&rsquo;s PECR, strictly necessary storage and a
          preference you set yourself are exempt from consent. If that ever changes - for example, if we
          were to add any analytics or advertising technology, or a campaign-measurement pixel to the
          website - we would update this page and add the appropriate consent controls first.
        </p>
        <p className="legal-note">
          This page is referenced by, and is part of, our <a href="/legal/privacy">Privacy Policy</a>. It
          describes client-side storage; for the full picture of what personal information we process and
          your choices, see the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>2. What we store in your browser (web)</h2>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Where</th>
                <th scope="col">What it&rsquo;s for</th>
                <th scope="col">Classification</th>
              </tr>
            </thead>
            <tbody>
              {WEB_ROWS.map((r) => (
                <tr key={r.item}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 700 }}>
                    {r.item}
                  </th>
                  <td>{r.where}</td>
                  <td>{r.purpose}</td>
                  <td>{r.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The map basemap is loaded directly from a map tile provider when you view the map; that request
          carries your IP address as any web request does, and is used only to serve the map. See our{" "}
          <a href="/legal/subprocessors">Sub-processors</a> page for who serves the map.
        </p>
      </section>

      <section>
        <h2>3. What we store on your device (mobile apps)</h2>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Where</th>
                <th scope="col">What it&rsquo;s for</th>
                <th scope="col">Classification</th>
              </tr>
            </thead>
            <tbody>
              {MOBILE_ROWS.map((r) => (
                <tr key={r.item}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 700 }}>
                    {r.item}
                  </th>
                  <td>{r.where}</td>
                  <td>{r.purpose}</td>
                  <td>{r.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4. Payment cookies on the donation page only</h2>
        <p>
          The donation page at <code>/donate/&lt;organization&gt;</code> is the one place in civfix that
          loads a third-party script: Stripe.js, which draws the payment form inside an iframe so that
          your card number never touches civfix&rsquo;s servers. Stripe.js sets the two cookies listed in
          Section 2 (<code>__stripe_mid</code> and <code>__stripe_sid</code>) for fraud prevention.
        </p>
        <p>
          Three deliberate engineering choices keep this narrow, and they are enforced in the build, not
          just described here:
        </p>
        <ul>
          <li>
            Stripe.js is loaded <strong>lazily and only from the donation page</strong>. Browse the map,
            file a report, sign up for an event, or read this page and no Stripe script runs and no
            Stripe cookie is set.
          </li>
          <li>
            We disable Stripe&rsquo;s optional <em>advanced fraud signals</em> beacon, so no telemetry
            request is made to <code>m.stripe.com</code> merely because the page loaded. Stripe still
            runs its fraud checks on its own servers when you submit a payment.
          </li>
          <li>
            The site&rsquo;s Content-Security-Policy permits Stripe&rsquo;s origins on{" "}
            <code>/donate/*</code> and nowhere else, so a Stripe script could not execute on another
            page even by accident.
          </li>
        </ul>
        <p>
          These cookies are strictly necessary for a payment you have chosen to make: without them
          Stripe cannot distinguish you from an automated card-testing attack and the payment would be
          refused. They are not used for advertising, profiling or measurement, and they are not read by
          civfix. That is why the donation page also carries no consent banner. If you do not want them,
          do not open the donation page.
        </p>
      </section>

      <section>
        <h2>5. No advertising or cross-site tracking</h2>
        <p>
          Apart from the payment cookies described in Section 4, civfix runs no advertising, analytics,
          or third-party tracking technology inside the apps or website. We do not set third-party
          tracking cookies, do not build advertising profiles, and do not sell or &ldquo;share&rdquo;
          your personal information for cross-context behavioral advertising as those terms are used
          under US state privacy laws. Our error-tracking system is self-hosted on our own infrastructure
          rather than a third-party analytics vendor. Event hosts can see how many people opened their
          signup page, but only as a count - there is no per-visitor identifier behind it and no
          engagement tracking in the messages a host sends.
        </p>
        <p>
          We may promote civfix on outside platforms such as social media. That is advertising{" "}
          <em>about</em> civfix on someone else&rsquo;s platform, governed by that platform&rsquo;s own
          policies; it does not place any cookie, pixel, or tracker inside civfix. If we ever add a
          campaign-measurement pixel to our own website to see how those promotions perform, that would be
          non-essential tracking - so we would add a consent banner and ask for your permission first, as
          described in Section 1.
        </p>
      </section>

      <section>
        <h2>6. Your controls</h2>
        <p>
          You can clear the cookies and local storage above at any time through your browser settings, or
          by signing out (which clears your session). On mobile, signing out clears the stored
          authentication token, and removing the app clears its on-device storage. Clearing strictly
          necessary storage will sign you out and reset your saved preferences. The Stripe payment
          cookies clear with your browser&rsquo;s cookies like any other; clearing them does not affect a
          donation you have already completed.
        </p>
      </section>

      <section>
        <h2>7. Contact us</h2>
        <p>
          Questions about cookies or storage? Email{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>.
        </p>
      </section>
    </LegalPage>
  )
}
