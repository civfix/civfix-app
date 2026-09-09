import type { Metadata } from "next"
import { DONATION_DISCLOSURE_TEMPLATE } from "@civfix/shared/legal"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Donation Disclosures · civfix",
  description:
    "The exact wording civfix displays to a donor before they give, and the values substituted into it for each organization.",
  robots: { index: false, follow: true },
}

const T = DONATION_DISCLOSURE_TEMPLATE

export default function DonationDisclosurePage() {
  return (
    <LegalPage
      active="donation-disclosure"
      title="Donation Disclosures"
      intro="The exact wording every donor sees before they give"
    >
      <section>
        <h2>1. What this page is</h2>
        <p>
          California Government Code section 12599.9 and 11 CCR section 319 require a charitable
          fundraising platform to make specific disclosures to a donor, conspicuously, before the
          donation is made. This page publishes the exact template those disclosures are built from,
          so that the wording a donor was shown is a versioned, hashed document rather than
          whatever the page happened to say that day.
        </p>
        <p>
          The template lives in the civfix contract package and is the single source the donation
          page and the server both render from. A change to the wording is a change to this
          document: it moves the version, the effective date and the hash together.
        </p>
        <p>
          This page is not addressed to donors. Donors see the finished sentences, with the values
          below filled in, on the donation page itself.
        </p>
      </section>

      <section>
        <h2>2. Values substituted for each organization</h2>
        <p>
          A double-braced name below is replaced, per organization and per donation, with a value
          civfix holds &mdash; never with text the organization wrote:
        </p>
        <ul>
          <li>
            <code>{"{{orgLegalName}}"}</code> &mdash; the organization&rsquo;s legal name exactly as
            it appears in the IRS records civfix verified it against.
          </li>
          <li>
            <code>{"{{platformFeePercent}}"}</code> &mdash; the civfix platform fee that applies to
            this donation, as a percentage to two decimal places.
          </li>
          <li>
            <code>{"{{webOrigin}}"}</code> &mdash; the civfix web origin, so the link resolves to
            this site.
          </li>
        </ul>
        <p>
          Two sentences vary by fact rather than by value: the deductibility sentence depends on
          whether civfix has verified the organization as currently tax exempt, and the refund
          sentence uses the organization&rsquo;s own refund policy where it has supplied one.
        </p>
      </section>

      <section>
        <h2>3. Who receives the donation</h2>
        <p>{T.recipient}</p>
      </section>

      <section>
        <h2>4. When the organization may not receive it</h2>
        <p>{T.mayNotReceive}</p>
        <ul>
          {T.mayNotReceiveReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p>
          The donor is shown that sentence next to a link to{" "}
          <code>{T.mayNotReceiveUrl}</code>, which resolves to the{" "}
          <a href="/legal/donations#may-not-receive">Donations &amp; Fundraising</a> page.
        </p>
      </section>

      <section>
        <h2>5. When the funds arrive</h2>
        <p>{T.remittanceTiming}</p>
      </section>

      <section>
        <h2>6. Fees</h2>
        <p>{T.feePointer}</p>
        <p>
          The donor is also shown an itemized breakdown of the exact amounts &mdash; gross,
          platform fee, estimated processing fee and net to the organization &mdash; before they
          confirm the payment. civfix never states or implies that the whole donation reaches the
          organization.
        </p>
      </section>

      <section>
        <h2>7. Tax deductibility</h2>
        <p>
          Where civfix has verified the organization as currently exempt under section 501(c)(3),
          the donor is shown:
        </p>
        <p className="legal-note">{T.deductible}</p>
        <p>Otherwise the donor is shown:</p>
        <p className="legal-note">{T.notDeductible}</p>
        <p>
          Either sentence is accompanied by the date on which civfix last checked the
          organization&rsquo;s status against public records.
        </p>
      </section>

      <section>
        <h2>8. Merchant of record</h2>
        <p>{T.merchantOfRecord}</p>
      </section>

      <section>
        <h2>9. Refunds</h2>
        <p>
          Where the organization has supplied its own refund policy, that text is shown. Where it
          has not, the donor is shown:
        </p>
        <p className="legal-note">{T.defaultRefundPolicy}</p>
      </section>

      <section>
        <h2>10. Where these appear</h2>
        <p>
          All of the above are rendered together, above the payment form and above the terms
          confirmation, so a donor reaches the pay button only after passing them. The version of
          this document that produced them is recorded with the donation, alongside the donor&rsquo;s
          consent.
        </p>
        <p>
          The organization&rsquo;s side of the same arrangement is set out in the{" "}
          <a href="/legal/org-donation-agreement">Organization Donation Agreement</a>. Broader donor
          information is on the <a href="/legal/donations">Donations &amp; Fundraising</a> page.
        </p>
      </section>
    </LegalPage>
  )
}
