import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Sub-processors · civfix",
  description: "The third-party providers civfix uses to process personal data.",
}

interface Row {
  name: string
  purpose: string
  data: string
  location: string
}

const ROWS: Row[] = [
  {
    name: "Oracle Cloud Infrastructure (Oracle America, Inc.)",
    purpose: "Outbound transactional and notification email (OCI Email Delivery).",
    data: "Recipient email addresses and the contents of the emails we send (for example sign-in codes and report or notification updates).",
    location: "United States / global",
  },
  {
    name: "Cloudflare, Inc.",
    purpose:
      "Object storage (R2) for report photos and videos; content-delivery network for media; web app hosting (Cloudflare Pages); anti-bot challenge (Turnstile); edge security / WAF; inbound email routing; coarse IP-based geolocation for the location sanity check.",
    data: "Report photos and videos; IP addresses; request metadata; anti-abuse challenge signals; inbound email content.",
    location: "United States / global",
  },
  {
    name: "CARTO & OpenStreetMap contributors",
    purpose:
      "Map basemap tiles loaded directly by your device or browser when you view the map.",
    data: "IP address and tile requests made by your client when the basemap loads.",
    location: "United States / EU",
  },
  {
    name: "Mapbox, Inc.",
    purpose:
      "Address search / autocomplete and reverse geocoding (turning a selected map location into a street address) for the report and event location pickers. Requests are proxied through civfix's own servers, not sent directly from your device.",
    data: "The address text you type into location search and the coordinates of the location you select or pin on the map (including the map area used to rank nearby results). Because the request comes from our server, your device IP address is not shared with Mapbox.",
    location: "United States",
  },
  {
    name: "komoot (Photon geocoder)",
    purpose:
      "The same address search / autocomplete and reverse geocoding as Mapbox, served by the free, open-source Photon geocoding service (photon.komoot.io). This is the keyless fallback used when Mapbox is unavailable or not enabled. Requests are proxied through civfix's own servers. As a free public endpoint it is used under its public terms of use, without a separate data-processing agreement.",
    data: "The address text you type into location search and the coordinates of the location you select or pin on the map. Because the request comes from our server, your device IP address is not shared with komoot.",
    location: "Germany / EU",
  },
  {
    name: "Stripe, Inc. and Stripe Payments Company",
    purpose:
      "Payment processing for donations to host organizations. Donations are DIRECT charges on the recipient organization's own Stripe connected account: the organization is the merchant of record and civfix never receives or holds the funds. Stripe also acts as an INDEPENDENT CONTROLLER (not our processor) for fraud prevention, anti-money-laundering, sanctions screening and its own regulatory obligations, and it is the licensed money transmitter in the flow.",
    data: "Donor name and email address; the donation amount and currency; the card or wallet payment details you enter directly into Stripe's hosted iframe (these never reach civfix's servers); the last four digits and brand of the card, returned to us for your receipt; IP address and device signals Stripe collects for fraud prevention.",
    location: "United States, with onward transfers to Stripe entities in the EU and UK",
  },
  {
    name: "Apple Inc.",
    purpose:
      "Sign in with Apple (authentication) and the Apple Push Notification service (push notifications to iOS devices).",
    data: "Account identifier provided at sign-in; device push tokens and notification payloads.",
    location: "United States",
  },
  {
    name: "Google LLC",
    purpose:
      "Sign in with Google (authentication) and Firebase Cloud Messaging (push notifications to Android and web).",
    data: "Account identifier provided at sign-in; device push tokens and notification payloads.",
    location: "United States",
  },
]

export default function SubprocessorsPage() {
  return (
    <LegalPage
      active="subprocessors"
      title="Sub-processors"
      intro="Third parties that help us run civfix"
    >
      <section>
        <p>
          civfix uses a small set of third-party providers to operate the service. Each one Processes
          personal data on our behalf, under contract (or, for our open-source geocoding fallback, under
          its public terms of use), only to provide its part of civfix. We keep the list short on
          purpose. This page is the list referenced by our{" "}
          <a href="/legal/privacy">Privacy Policy</a>.
        </p>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Sub-processor</th>
                <th scope="col">Purpose</th>
                <th scope="col">Personal data processed</th>
                <th scope="col">Location</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 700 }}>
                    {r.name}
                  </th>
                  <td>{r.purpose}</td>
                  <td>{r.data}</td>
                  <td>{r.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Sign-in and routing</h2>
        <p>
          When you sign in through an identity provider (such as Google or Apple), that provider acts as
          an independent controller of your relationship with it; we receive only a basic identifier.
          When we forward a report to the government body responsible for a location, that agency
          receives the report as an independent recipient, not as our sub-processor.
        </p>
        <p>
          A payment processor plays BOTH roles at once. Stripe processes donor data on our behalf when
          it charges a donation we initiated, and it is an independent controller of the same data for
          fraud prevention, anti-money-laundering and sanctions screening, and its own legal and
          regulatory reporting. Where Stripe acts as an independent controller, its own privacy notice
          governs and civfix cannot direct or delete that processing. The recipient host organization is
          likewise an independent controller of any donor identity it receives - which happens only when
          you explicitly opt in on the donation page.
        </p>
      </section>

      <section>
        <h2>International transfers</h2>
        <p>
          civfix is operated from the United States, and several of the providers above are located in the
          United States and other countries. Where we transfer the personal information of users in the
          European Economic Area, the United Kingdom, or Switzerland to a country without an adequacy
          decision, we rely on appropriate safeguards - principally the European Commission&rsquo;s
          Standard Contractual Clauses and the UK International Data Transfer Addendum, together with the
          EU-US / UK Extension / Swiss-US Data Privacy Framework where the provider is certified. See the{" "}
          <a href="/legal/privacy">Privacy Policy</a> for details and how to request a copy of the
          safeguards.
        </p>
        <p>
          For payment processing specifically, Stripe self-certifies under the EU-US Data Privacy
          Framework, the UK Extension and the Swiss-US Data Privacy Framework, and additionally relies on
          the European Commission&rsquo;s Standard Contractual Clauses (Modules One and Two) together
          with the UK International Data Transfer Addendum. Stripe publishes these terms in its{" "}
          <a href="https://stripe.com/legal/dpa" rel="noreferrer noopener" target="_blank">
            Data Processing Agreement
          </a>{" "}
          and its{" "}
          <a href="https://stripe.com/privacy" rel="noreferrer noopener" target="_blank">
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Changes to this list</h2>
        <p>
          We may add or replace sub-processors as civfix evolves. When we do, we will update this page
          and the &ldquo;Last updated&rdquo; date. For questions, email{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>.
        </p>
      </section>
    </LegalPage>
  )
}
