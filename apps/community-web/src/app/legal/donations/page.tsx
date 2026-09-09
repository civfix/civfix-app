import type { Metadata } from "next"

import { CA_REGISTRATION_LABEL, LEGAL_ENTITY, LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Donations & Fundraising · civfix",
  description:
    "How donations through civfix work: who receives your money, how we verify organizations, what the fees are, and your rights as a donor.",
  robots: { index: true, follow: true },
}

export default function DonationsPage() {
  return (
    <LegalPage
      active="donations"
      title="Donations & Fundraising"
      intro="Who receives your donation, how we check them, and what it costs"
    >
      <section>
        <h2>1. What this page is</h2>
        <p>
          California&rsquo;s Assembly Bill 488 (Government Code section 12599.9) requires an online
          platform that lets people donate to charities to publish, in one place, who it is, which
          charities it enables people to support, how it verifies them, what it charges, and what
          happens if a donation cannot be delivered. This page is that disclosure. It is written for
          donors, and it is deliberately blunt.
        </p>
      </section>

      <section>
        <h2>2. Who we are</h2>
        <p>
          civfix is operated by <strong>{LEGAL_ENTITY}</strong>, a 501(c)(3) nonprofit organization
          based in Los Angeles, California. When you donate through civfix to another organization,{" "}
          {LEGAL_ENTITY} is acting as a <strong>charitable fundraising platform</strong> - not as the
          recipient of your gift.
        </p>
        <p>
          <strong>California charitable fundraising platform registration number:</strong>{" "}
          {CA_REGISTRATION_LABEL}. Our registration and any organization&rsquo;s registration can be
          checked on the California Attorney General&rsquo;s{" "}
          <a
            href="https://rct.doj.ca.gov/Verification/Web/Search.aspx"
            rel="noreferrer noopener"
            target="_blank"
          >
            Registry of Charities and Fundraisers search tool
          </a>
          .
        </p>
      </section>

      <section>
        <h2>3. Who receives your donation</h2>
        <p>
          <strong>The organization named on the donation page receives your donation.</strong> Not
          civfix. Your card is charged directly on that organization&rsquo;s own account with our
          payment processor, Stripe, and the money settles into that organization&rsquo;s account. The
          organization is the <em>merchant of record</em>: it is the party that took your payment.
        </p>
        <p>
          <strong>civfix never holds, pools, or disburses donated funds.</strong> There is no civfix
          balance the money passes through and no point at which civfix could decide to send your
          donation somewhere else. That is a structural property of how the payments are built, not a
          promise about how we behave.
        </p>
        <p>
          Because the funds settle into the organization&rsquo;s own account as the payment clears,
          there is no separate remittance step and no holding period: the maximum time between your
          donation and the organization receiving it is the payment processor&rsquo;s standard
          settlement time for that organization&rsquo;s account.
        </p>
      </section>

      <section>
        <h2>4. How we verify the organizations you can donate to</h2>
        <p>
          Only organizations we have verified as tax-exempt under Internal Revenue Code section
          501(c)(3), <strong>and</strong> that are in good standing, can appear with a donate option.
          We check, and re-check, against these public sources:
        </p>
        <ul>
          <li>
            the IRS <strong>Publication 78</strong> data (organizations eligible to receive
            tax-deductible contributions) and the <strong>Exempt Organizations Business Master File</strong>;
          </li>
          <li>
            the IRS <strong>Automatic Revocation of Exemption List</strong> - with the important caveat
            that an organization whose exemption was <em>reinstated</em> stays on that list forever, so
            we never treat a bare appearance on it as disqualifying;
          </li>
          <li>
            the California Franchise Tax Board&rsquo;s <strong>revoked exempt organizations</strong>{" "}
            list;
          </li>
          <li>
            the California Attorney General&rsquo;s <strong>Registry of Charities and Fundraisers</strong>,
            including the <strong>&ldquo;May Not Operate or Solicit for Charitable Purposes&rdquo;</strong>{" "}
            list, which is a hard bar; and
          </li>
          <li>the US Treasury OFAC sanctions list.</li>
        </ul>
        <p>
          Every organization is checked before it can be onboarded and re-checked on a schedule as each
          source publishes a new revision. We record which revision of which list a verdict was computed
          against, and we check again at the moment a donation is authorized - so a donation is never
          authorized to an organization that has lost its standing since the page was loaded.
        </p>
        <p>
          If an organization loses its good standing, its donate option is switched off. The donation
          page shows you the date we last verified the organization&rsquo;s deductibility status; if
          that date looks stale to you, treat it as stale.
        </p>
      </section>

      <section>
        <h2>5. Fees</h2>
        <p>
          <strong>civfix charges a platform fee of 5% of your donation.</strong> Separately, the payment
          processor charges the recipient organization a card-processing fee, which is deducted from the
          amount it receives.
        </p>
        <p>
          Both are itemized on the donation page - your donation, the estimated processing fee, the
          civfix platform fee, and the estimated amount the organization receives - and they are shown{" "}
          <strong>before you enter any payment details</strong>. The processing fee is an estimate
          because the exact amount depends on the card or wallet you use; your receipt carries the exact
          figures.
        </p>
        <p>
          <strong>
            We will never tell you that 100% of your donation reaches the organization.
          </strong>{" "}
          It does not, and California law specifically prohibits saying so.
        </p>
        <p>
          If your donation is refunded in whole or in part, civfix reverses its platform fee
          proportionally. The processor generally keeps its own fee on a refunded payment; that cost is
          borne by the organization, not by you.
        </p>
      </section>

      <section id="may-not-receive">
        <h2>6. When an organization may not receive your donation</h2>
        <p>
          In the overwhelming majority of cases the organization you chose receives your donation. There
          are narrow circumstances in which it may not:
        </p>
        <ul>
          <li>
            the organization <strong>loses its tax-exempt status or good standing</strong> - for example
            it is revoked by the IRS or the Franchise Tax Board, or added to the California Attorney
            General&rsquo;s &ldquo;May Not Operate or Solicit&rdquo; list - between the moment you
            donated and the moment the payment settles;
          </li>
          <li>
            the payment processor <strong>disables the organization&rsquo;s account</strong> (for
            example during a verification review), so the payment cannot complete;
          </li>
          <li>
            the payment <strong>fails, is reversed, or is disputed</strong> by your card issuer; or
          </li>
          <li>
            the organization <strong>declines the donation</strong> or asks to be removed from civfix.
          </li>
        </ul>
        <p>
          If any of these happens to your donation,{" "}
          <strong>we will tell you and the donation will be refunded to your card.</strong> civfix does
          not redirect a donation to a different organization, and it does not keep it. Because the money
          never enters a civfix account, there is nothing for us to redirect.
        </p>
      </section>

      <section>
        <h2>7. Removing an organization</h2>
        <p>
          An organization can ask to be removed from civfix at any time by emailing{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a> from an address at its own
          domain, or through its civfix account. We disable its donate option promptly and confirm in
          writing. We also remove an organization on our own initiative when it loses good standing, when
          a regulator directs us to, or when we reasonably suspect fraud or misuse. Removal does not
          affect donations that have already settled into the organization&rsquo;s account.
        </p>
      </section>

      <section>
        <h2>8. Your rights as a donor</h2>
        <ul>
          <li>
            <strong>A receipt.</strong> We email a receipt for every completed donation, as the
            organization&rsquo;s authorized agent, normally within minutes and in any case{" "}
            <strong>within five business days</strong>. It names the organization, the amount, the date
            your card was charged, whether the gift is tax-deductible and to what extent, and an
            itemization of the fees.
          </li>
          <li>
            <strong>Your donation history.</strong> If you donated while signed in to a civfix account,
            every donation you have made and its receipt are available in your account.
          </li>
          <li>
            <strong>Anonymity by default.</strong> The recipient organization does not learn who you are
            unless you check the box on the donation page saying it may. That box is{" "}
            <strong>off by default</strong> and we never pre-check it.
          </li>
          <li>
            <strong>Refunds.</strong> Donations are non-refundable except where the law requires it or
            the organization chooses to refund. The organization controls refunds for its own donations;
            contact it first. If a charge was unauthorized, contact us and your card issuer.
          </li>
          <li>
            <strong>Complaints.</strong> Email us at{" "}
            <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>. You can also complain to the
            California Attorney General&rsquo;s Registry of Charities and Fundraisers, at{" "}
            <a
              href="https://oag.ca.gov/charities/complaints"
              rel="noreferrer noopener"
              target="_blank"
            >
              oag.ca.gov/charities/complaints
            </a>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Tax deductibility</h2>
        <p>
          Whether your donation is deductible depends on the recipient organization&rsquo;s tax status,
          not on civfix. The donation page states the organization&rsquo;s deductibility status and the
          date we last verified it against IRS records, and your receipt repeats it. For a single
          donation of <strong>$250 or more</strong>, US tax law requires you to hold a contemporaneous
          written acknowledgment from the charity to claim a deduction - keep the receipt we send. We do
          not give tax advice.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about a donation, this page, or an organization listed on civfix: email{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>. See also our{" "}
          <a href="/legal/terms">Terms of Service</a> (donations, fees, refunds and host-organization
          terms), our <a href="/legal/privacy">Privacy Policy</a> (what we collect and how long we keep
          it), and our <a href="/legal/subprocessors">Sub-processors</a> list.
        </p>
      </section>
    </LegalPage>
  )
}
