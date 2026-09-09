import * as React from "react"

import {
  CA_REGISTRATION_LABEL,
  DONATIONS_CONTACT_EMAIL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY,
  PLATFORM_FEE_LABEL,
} from "./legal-entity"

export function OrgDonationAgreementBody() {
  return (
    <>
      <section>
        <h2>1. Parties and scope</h2>
        <p>
          This Organization Donation Agreement (the <strong>&ldquo;Agreement&rdquo;</strong>) is
          between <strong>{LEGAL_ENTITY}</strong>, which operates the civfix platform (
          <strong>&ldquo;civfix&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>,{" "}
          <strong>&ldquo;us&rdquo;</strong>), and the organization that accepts it (
          <strong>&ldquo;you&rdquo;</strong>, <strong>&ldquo;your organization&rdquo;</strong>). It
          governs one thing only: your use of civfix to solicit and receive charitable donations from
          the public.
        </p>
        <p>
          It is required by California Government Code section 12599.9 and its implementing
          regulation, 11 CCR section 318, which oblige a charitable fundraising platform to have a
          written, versioned agreement with every charity it enables people to donate to, and to
          record that charity&rsquo;s consent to it before solicitation begins.
        </p>
        <p>
          This Agreement supplements the civfix Terms of Service and Privacy Policy, which continue
          to apply to your organization&rsquo;s use of civfix generally. Where this Agreement and the
          Terms of Service conflict on a donations question, this Agreement controls.
        </p>
        <p className="legal-note">
          You are not required to use civfix to fundraise, and accepting this Agreement does not
          oblige you to keep donations turned on. You can switch donations off at any time from your
          organization&rsquo;s Payments settings.
        </p>
      </section>

      <section>
        <h2>2. Definitions</h2>
        <ul>
          <li>
            <strong>Donation</strong> &mdash; a charitable contribution a donor makes to your
            organization through a civfix donation page.
          </li>
          <li>
            <strong>Donation page</strong> &mdash; the civfix page that solicits donations for your
            organization, including any event page that links to it.
          </li>
          <li>
            <strong>Processor</strong> &mdash; Stripe, Inc. and its affiliates, the payment processor
            civfix uses. civfix uses no other payment processor for donations.
          </li>
          <li>
            <strong>Connected account</strong> &mdash; the Stripe account, held in your
            organization&rsquo;s own name, into which donations are charged and settled.
          </li>
          <li>
            <strong>Platform fee</strong> &mdash; the fee civfix charges on a donation, described in
            section 7.
          </li>
          <li>
            <strong>Processing fees</strong> &mdash; the fees the Processor charges your connected
            account for accepting a payment.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Who civfix is in this relationship</h2>
        <p>
          civfix is a <strong>charitable fundraising platform</strong> under California Government
          Code section 12599.9. It is not a commercial fundraiser, not a fundraising counsel, and not
          your agent for any purpose except issuing donation receipts (section 9).
        </p>
        <p>
          <strong>civfix does not receive, hold, pool or disburse your donations.</strong> Every
          donation is charged directly on your connected account and settles to that account. There
          is no civfix balance the money passes through, and no point at which civfix could route a
          donation elsewhere. That is a property of how the payments are built, not a promise about
          how we behave.
        </p>
        <p>
          civfix&rsquo;s California charitable fundraising platform registration number is{" "}
          <strong>{CA_REGISTRATION_LABEL}</strong>. civfix will not solicit donations for your
          organization before that registration is effective.
        </p>
      </section>

      <section>
        <h2>4. Your eligibility and representations</h2>
        <p>By accepting this Agreement, and each time a donation is made, you represent that:</p>
        <ul>
          <li>
            your organization is <strong>exempt from federal income tax under section 501(c)(3)</strong>{" "}
            of the Internal Revenue Code, and that exemption has not been revoked, suspended or
            placed under examination for revocation;
          </li>
          <li>
            your organization is in <strong>good standing</strong>: it is not on the IRS Automatic
            Revocation of Exemption List, not revoked by the California Franchise Tax Board, not
            listed on the California Attorney General&rsquo;s <em>May Not Operate or Solicit for
            Charitable Purposes</em> list, not on any U.S. Treasury OFAC sanctions list, and current
            on its registration and reporting obligations in every jurisdiction where it solicits;
          </li>
          <li>
            the legal name, employer identification number, address and contact details you have
            given civfix are accurate and match your organization&rsquo;s IRS records;
          </li>
          <li>
            the individual accepting this Agreement is <strong>authorized</strong> to bind your
            organization; and
          </li>
          <li>
            donations solicited through civfix will be used for your organization&rsquo;s charitable
            purposes as described on the donation page.
          </li>
        </ul>
        <p>
          <strong>Duty to notify.</strong> You will notify civfix in writing{" "}
          <strong>within five (5) business days</strong> if any of these representations stops being
          true &mdash; in particular if your tax-exempt status is revoked, suspended or challenged,
          if you are added to any of the lists above, if your registration in a solicitation
          jurisdiction lapses, or if your legal name or employer identification number changes. Send
          the notice to <a href={`mailto:${DONATIONS_CONTACT_EMAIL}`}>{DONATIONS_CONTACT_EMAIL}</a>.
        </p>
        <p>
          civfix independently re-checks public sources (IRS Publication 78, the IRS Exempt
          Organizations Business Master File and Auto-Revocation List, the California Franchise Tax
          Board and Attorney General registries, and OFAC) on a recurring schedule, and may suspend
          donations under section 12 on what it finds. That checking does not reduce your duty to
          notify us.
        </p>
      </section>

      <section>
        <h2>5. Your Stripe connected account</h2>
        <p>
          To receive donations you must complete Stripe&rsquo;s onboarding and hold a connected
          account in your organization&rsquo;s own name.{" "}
          <strong>
            You accept the Stripe Connected Account Agreement directly with Stripe during that
            onboarding
          </strong>{" "}
          &mdash; it is a separate contract between your organization and Stripe, not something
          civfix accepts on your behalf. civfix cannot waive, vary or interpret it.
        </p>
        <p>Under that arrangement:</p>
        <ul>
          <li>
            <strong>Your organization is the merchant of record</strong> for every donation. It is
            the party that took the payment.
          </li>
          <li>
            <strong>Stripe pays out directly to your organization&rsquo;s bank account</strong> on
            Stripe&rsquo;s payout schedule. civfix does not control, delay or approve payouts and
            cannot release funds Stripe is holding.
          </li>
          <li>
            <strong>Your organization pays the processing fees</strong> Stripe charges on each
            donation. civfix does not absorb them and does not add them to the donor&rsquo;s charge.
          </li>
          <li>
            <strong>Stripe, not civfix, files any Form 1099-K</strong> for your connected account and
            sets the pricing on it.
          </li>
          <li>
            Stripe may request identity and business documentation, hold funds, or restrict your
            account under its own agreement. If Stripe restricts your account, civfix will show
            donations as unavailable until Stripe clears it.
          </li>
        </ul>
        <p>
          You are responsible for your organization&rsquo;s own tax reporting, acknowledgment and
          substantiation obligations arising from donations, and for keeping your connected
          account&rsquo;s details current.
        </p>
      </section>

      <section>
        <h2>6. What civfix displays on your donation page</h2>
        <p>
          California law requires a set of donor-facing disclosures on the page where a donation is
          solicited. <strong>civfix authors and displays them; you cannot edit or suppress them.</strong>{" "}
          They are generated from verified data, not from text you supply. The current wording is
          published, versioned and hashed at{" "}
          <a href="/legal/donation-disclosure">civfix.org/legal/donation-disclosure</a>.
        </p>
        <p>Your donation page will state:</p>
        <ul>
          <li>that your organization, named by its IRS legal name, receives the donation directly;</li>
          <li>
            that there are limited circumstances in which your organization may not receive a
            donation, with those circumstances listed and linked;
          </li>
          <li>when the funds reach your organization;</li>
          <li>
            the civfix platform fee, itemized before the donor pays, and that your organization pays
            its own processing fees;
          </li>
          <li>
            whether donations to your organization are tax deductible, and when civfix last checked;
          </li>
          <li>that your organization is the merchant of record and civfix is not the organizer; and</li>
          <li>the refund policy that applies.</li>
        </ul>
        <p>
          You may supply an organization refund-policy statement and a short mission description.
          Both must be accurate and not misleading. civfix will never display a claim that 100% of a
          donation reaches your organization, because it does not.
        </p>
      </section>

      <section>
        <h2>7. Fees</h2>
        <p>
          civfix charges a platform fee of <strong>{PLATFORM_FEE_LABEL} of the donation amount</strong>.
          It is collected by the Processor as an application fee on the same charge, so the donor sees
          it itemized before paying and your organization receives the donation less that fee and
          less the Processor&rsquo;s own fees.
        </p>
        <p>
          The rate that applies to your organization is <strong>recorded with your acceptance of this
          Agreement</strong>. If the two ever disagree, civfix charges the lower of the rate recorded
          with your acceptance and the platform&rsquo;s configured rate. A fee increase is not a
          settings change: it requires a new version of this Agreement, notice to you under section
          13, and your acceptance of that version before the new rate applies.
        </p>
        <p>
          civfix does not charge your organization a subscription, listing, onboarding or payout fee,
          and does not add a separate charge to the donor. Where civfix refunds a donation&rsquo;s
          platform fee it does so proportionally (section 8).
        </p>
      </section>

      <section>
        <h2>8. Refunds, chargebacks and disputes</h2>
        <p>
          <strong>Refunds and disputes are your organization&rsquo;s to resolve.</strong> Because you
          are the merchant of record, a refund comes out of your connected account and a chargeback
          is contested by your organization through Stripe. civfix has no authority to refund a
          donation on your behalf and no liability for a negative balance on your account.
        </p>
        <p>
          Donations are presented to donors as generally non-refundable, subject to your
          organization&rsquo;s discretion and to any right the donor has under law. Where a donation
          is refunded or a dispute is lost, <strong>civfix refunds its platform fee
          proportionally</strong>. Processing fees charged by the Processor are not returned by
          civfix and may not be returned by the Processor.
        </p>
        <p>
          You will handle donor complaints about your organization, its programs and its use of
          donations. civfix will forward complaints it receives and may report to the California
          Attorney General as required.
        </p>
      </section>

      <section>
        <h2>9. Receipts &mdash; civfix as your authorized agent</h2>
        <p>
          <strong>
            You appoint civfix as your organization&rsquo;s authorized agent for the limited purpose
            of issuing a written donation receipt to each donor on your behalf
          </strong>
          , as contemplated by 11 CCR section 318(a)(9). civfix will send that receipt{" "}
          <strong>within five (5) business days</strong> of the donation being charged, to the email
          address the donor gave.
        </p>
        <p>The receipt will identify your organization by its IRS legal name, employer identification number and address; state the donation amount and the date it was charged; state that no goods or services were provided in exchange for the contribution; state whether the contribution is tax deductible; itemize the platform fee and the processing fee; and carry the donation and receipt identifiers.</p>
        <p>
          This appointment is limited to issuing receipts. It does not make civfix your agent for
          soliciting, accepting, holding or applying donations, and it does not relieve your
          organization of its own substantiation obligations, including contemporaneous written
          acknowledgment for contributions of $250 or more. civfix does not provide tax advice to
          your organization or to donors.
        </p>
      </section>

      <section>
        <h2>10. Donor information and privacy</h2>
        <p>
          <strong>civfix shares a donor&rsquo;s identity with your organization only where that donor
          has opted in.</strong> The donation form asks, unchecked by default, whether the donor wants
          their name and email address shared with your organization. Where they do not, the donation
          appears in your reports as an anonymous donation with no identifying detail.
        </p>
        <p>
          Payment details never reach civfix or your organization through civfix: card data is
          entered inside the Processor&rsquo;s own hosted fields and is held by the Processor.
        </p>
        <p>
          Where donor personal information is shared with you, your organization is an independent
          controller of it. You will handle it in accordance with applicable privacy law, use it only
          for donor stewardship and legally required reporting, honor deletion and opt-out requests
          you receive, and not sell or share it for cross-context behavioral advertising. civfix&rsquo;s
          own handling is described in the <a href="/legal/privacy">Privacy Policy</a> and its
          processors are listed at <a href="/legal/subprocessors">Sub-processors</a>.
        </p>
      </section>

      <section>
        <h2>11. Records, reporting and retention</h2>
        <p>
          civfix keeps a record of every donation solicited for your organization &mdash; the amount,
          the fees, the date, the donation and receipt identifiers, and the consent evidence for this
          Agreement &mdash; for <strong>at least seven (7) years</strong> from the date of the charge,
          and longer where a legal hold applies. Consent records are never deleted by any retention or
          erasure process: they are the evidence that the donation beside them was lawfully collected.
        </p>
        <p>
          civfix makes a donation report available to your organization in the host console, covering
          each donation, the fees deducted, the net amount, the receipt status and (where shared) the
          donor, exportable as CSV. That report is the record contemplated by 11 CCR section 321.
        </p>
        <p>
          You will keep your own records of donations received through civfix and of how they were
          applied, as required of your organization by law.
        </p>
      </section>

      <section>
        <h2>12. Suspension and termination</h2>
        <p>
          <strong>civfix may suspend or disable donations for your organization immediately</strong>{" "}
          if any representation in section 4 stops being true or civfix reasonably believes it has;
          if a public source shows a loss of exempt status, a revocation, a sanctions listing or a
          &ldquo;may not solicit&rdquo; determination; if the Processor restricts your connected
          account; if a legal or regulatory authority requires it; or if civfix reasonably believes
          the donation page is being used unlawfully or deceptively.
        </p>
        <p>
          Where civfix suspends donations it will tell you why, and will restore them once the reason
          is resolved. Suspension stops new donations; it does not affect donations already charged,
          which remain your organization&rsquo;s money and settle normally.
        </p>
        <p>
          Either party may terminate this Agreement at any time on written notice. You can end it by
          turning donations off and telling us. Sections 8 through 11 and section 15 survive
          termination for as long as they are needed to complete, report on and retain records of
          donations already made.
        </p>
      </section>

      <section>
        <h2>13. Changes to this Agreement</h2>
        <p>
          civfix may publish a new version of this Agreement. Each version carries a version
          identifier, an effective date and a cryptographic hash of its text, published at{" "}
          <a href="/legal/org-donation-agreement">civfix.org/legal/org-donation-agreement</a>. Old
          versions are never edited, because acceptance records point at them.
        </p>
        <p>
          <strong>
            civfix will notify your organization of a new version and will ask you to accept it.
          </strong>{" "}
          A change that increases the platform fee, changes who receives donations, or changes the
          receipt agency in section 9 takes effect for your organization{" "}
          <strong>only once you have accepted the new version</strong>. Until then civfix continues to
          operate under the version you accepted, or pauses donations if it cannot. civfix keeps a log
          of these change notifications.
        </p>
      </section>

      <section>
        <h2>14. Electronic acceptance and evidence</h2>
        <p>
          This Agreement is accepted electronically. When your organization accepts it, civfix records
          the document type, the version, the sha256 hash of the exact text displayed, the time of
          acceptance, the account that accepted it, the surface and screen it was accepted on, and the
          version of the acceptance interface. That record is the evidence of consent required by 11
          CCR section 318, and it is retained under section 11.
        </p>
        <p>
          Acceptance also affirms that the person accepting has authority to bind your organization.
          You agree that an electronic acceptance recorded this way has the same effect as a signature.
        </p>
      </section>

      <section>
        <h2>15. General</h2>
        <p>
          <strong>Governing law.</strong> This Agreement is governed by the laws of the State of
          California, without regard to its conflict-of-laws rules. The state and federal courts
          located in Los Angeles County, California have exclusive jurisdiction over any dispute
          arising out of it, and each party consents to that jurisdiction.
        </p>
        <p>
          <strong>No partnership.</strong> Nothing here creates a partnership, joint venture,
          employment or franchise relationship, or (except for the limited receipt agency in section
          9) an agency relationship between civfix and your organization.
        </p>
        <p>
          <strong>Assignment.</strong> Neither party may assign this Agreement without the
          other&rsquo;s written consent, except to a successor in interest to substantially all of its
          assets or charitable purpose.
        </p>
        <p>
          <strong>Severability and waiver.</strong> If a provision is held unenforceable, the rest
          stays in force. A failure to enforce a provision is not a waiver of it.
        </p>
        <p>
          <strong>Entire agreement.</strong> This Agreement, together with the civfix Terms of Service
          and Privacy Policy, is the entire agreement between the parties about donations through
          civfix, and supersedes any prior understanding on that subject. It does not vary your
          separate agreement with the Processor.
        </p>
      </section>

      <section>
        <h2>16. Contact</h2>
        <p>
          Questions about this Agreement:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Notices required by
          section 4 or section 12:{" "}
          <a href={`mailto:${DONATIONS_CONTACT_EMAIL}`}>{DONATIONS_CONTACT_EMAIL}</a>. Postal notices
          may be sent to {LEGAL_ENTITY}, Los Angeles, California.
        </p>
        <p>
          A donor or member of the public with a concern about a charity may contact the California
          Attorney General&rsquo;s Registry of Charities and Fundraisers at{" "}
          <a
            href="https://oag.ca.gov/charities"
            rel="noreferrer noopener"
            target="_blank"
          >
            oag.ca.gov/charities
          </a>
          .
        </p>
      </section>
    </>
  )
}
