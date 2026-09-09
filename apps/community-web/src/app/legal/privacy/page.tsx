import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy · civfix",
  description: "What civfix collects, why, who we share it with, and your choices.",
}

interface RetentionRow {
  category: string
  period: string
  basis: string
}

const RETENTION_ROWS: RetentionRow[] = [
  {
    category: "Account information",
    period: "While the account is active, then until you ask us to delete it",
    basis: "Needed to operate your account.",
  },
  {
    category: "Published reports and their media",
    period: "Indefinitely",
    basis:
      "A published report is a civic record that has been forwarded to or relied on by a government agency. It survives deletion of the account that filed it, shown as from a deleted user.",
  },
  {
    category: "Donation records (amount, fees, dates, status, card brand and last four)",
    period: "7 years from the date the card was charged",
    basis:
      "Financial record-keeping, charitable-solicitation reporting, receipt re-issue, and the dispute and chargeback window. This record is kept under a legal hold and is not deleted on request.",
  },
  {
    category: "Donor email address and name attached to a donation",
    period: "7 years from the charge date, then removed from the donation record",
    basis:
      "Part of the receipt and the evidence a specific person made a specific gift. After 7 years the contact details are removed and only the pseudonymous financial record remains.",
  },
  {
    category: "Records of the terms and disclosures you accepted",
    period: "For the life of the record they relate to",
    basis:
      "The version and content hash of what you were shown is the only proof of what you agreed to; it is worthless if it is deleted before the record it evidences.",
  },
  {
    category: "Payment card details",
    period: "Never stored",
    basis: "They go directly to Stripe and never reach civfix.",
  },
  {
    category: "Sanctions-screening evidence",
    period: "10 years",
    basis: "Required retention period for sanctions-screening records.",
  },
  {
    category: "Event registration answers to a host's questions",
    period: "30 days after the event",
    basis: "Hosts need them to run the event; after that they are scrubbed automatically.",
  },
  {
    category: "Event check-in records",
    period: "30 days after the event",
    basis: "Attendance is only needed while the host is closing out the event.",
  },
  {
    category: "Guest (no-account) event RSVP contact details",
    period: "30 days after the event, or immediately on cancellation",
    basis:
      "A guest gives an email or phone number only so the host can reach them about that one event.",
  },
  {
    category: "Delivery records for host messages (which message went to whom, and whether it sent)",
    period: "180 days",
    basis:
      "Enough to diagnose a failed delivery and enforce message limits. We record no opens and no clicks.",
  },
  {
    category: "Unsubscribe and suppression records",
    period: "Indefinitely",
    basis:
      "A suppression list that expires would start mailing someone who told us to stop. We keep the fact you unsubscribed for exactly that reason.",
  },
  {
    category: "Signup-page view counts",
    period: "Aggregated counts only, no per-visitor record at any point",
    basis:
      "Hosts see how many people opened their page. There is no visitor identifier to retain, so there is nothing to delete.",
  },
  {
    category: "Text-message opt-ins and opt-outs",
    period: "Opt-out records indefinitely; phone numbers per the rows above",
    basis:
      "Where an event host offers text-message reminders, we ask for a separate opt-in, tell you that message and data rates may apply, and keep a permanent record of any STOP so you are never messaged again.",
  },
  {
    category: "Security, audit and log data",
    period: "As long as it remains useful for operating and securing civfix",
    basis: "Fraud, abuse and incident investigation.",
  },
  {
    category: "Never-attached media uploads",
    period: "Swept shortly after upload",
    basis: "An orphaned upload has no purpose.",
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      active="privacy"
      title="Privacy Policy"
      intro="What we collect, why, and your choices"
    >
      <section>
        <h2>1. Overview</h2>
        <p>
          This Privacy Policy explains what personal information civfix collects, why we collect it, who
          we share it with, how long we keep it, and the choices and rights you have. civfix is operated
          by <strong>Reach Out Los Angeles</strong>, a registered 501(&zwnj;c)(3) nonprofit organization
          (&ldquo;Reach Out Los Angeles,&rdquo; &ldquo;civfix,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
          which is the controller of the personal information described here. It covers the civfix iOS
          app, Android app, and web app.
        </p>
        <p>
          civfix is built to do a specific thing: let you report a local issue at a precise place and
          route it to the responsible government body. So location and the photos or videos you attach
          are at the center of how it works. We try to collect only what we need for that, and we strip
          metadata we do not need (see Section 3).
        </p>
        <p>
          A note on scope. civfix is operated by a US-based 501(&zwnj;c)(3) nonprofit and is offered to
          residents of the United States, the European Economic Area (EEA), and the United Kingdom.
          Because we make civfix available to people in the EEA and the UK, the EU General Data Protection
          Regulation (GDPR) and the UK GDPR apply to our processing of their personal information; this
          Policy describes the legal bases we rely on (Section 3), how we transfer information
          internationally (Section 4), and the rights those laws give you (Section 8). Reach Out Los
          Angeles is the <strong>data controller</strong> for that information.
        </p>
        <p>
          We run <strong>no advertising, analytics, or third-party tracking technology inside the civfix
          apps or website</strong>; we do not build advertising profiles; and we do not sell your personal
          information or &ldquo;share&rdquo; it for cross-context behavioral advertising. We do promote
          civfix on outside channels such as social media - but that is advertising <em>about</em> civfix
          on other platforms and places no tracking inside civfix itself (see our{" "}
          <a href="/legal/cookies">Cookies &amp; Storage</a> notice). Some US state privacy laws that apply
          only to for-profit businesses - such as the California Consumer Privacy Act (CCPA) - do not bind a
          bona fide nonprofit, but we honor their substance as a matter of practice and extend the core of
          these rights to everyone.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>

        <h3>Account information</h3>
        <p>
          civfix does not use passwords. When you create an account you sign in through a third-party
          identity provider (for example Google or Apple), which shares with us a basic identifier such
          as your email address and, depending on the provider and your settings, your name. You may add
          a display name, a short bio, and a profile photo. We generate your default avatar from your
          identifier, so a photo is optional.
        </p>

        <h3>Reports and the content you submit</h3>
        <ul>
          <li>
            <strong>Precise location.</strong> The pin location (latitude and longitude) of the issue
            you report. This is precise geolocation and is treated as sensitive information under several
            laws. From the pin we derive the responsible jurisdiction and a coarse &ldquo;City,
            State&rdquo; label, and we compute an approximate grid cell used for clustering on the map
            and for abuse limits.
          </li>
          <li>
            <strong>Photos and videos.</strong> The media you attach to a report (up to five items per
            report). When media is processed, we read and then <strong>strip embedded metadata,
            including any GPS coordinates stored in the file (EXIF)</strong>, and we do not keep that raw
            GPS fix. We generate a thumbnail and, for video, re-encode the container to remove metadata.
          </li>
          <li>
            <strong>Report details.</strong> The category you choose, an optional description, and the
            report&rsquo;s status timeline over time.
          </li>
        </ul>

        <h3>Cleanups, chat, and social features</h3>
        <p>
          If you host or join a cleanup, we store the cleanup details (title, type, location, time,
          description, what to bring) and your membership. Cleanup group chat messages you send are
          stored so the conversation has history. We also store who you follow, who follows you, and
          your public profile, and we store reports you choose to follow.
        </p>

        <h3>Notifications</h3>
        <p>
          If you enable push notifications, we store a device push token so we can deliver them, plus
          your notification preferences (including any quiet hours). We store in-app notifications (such
          as a new follower or a report update).
        </p>

        <h3>Financial and payment information (donations)</h3>
        <p>
          If you donate to a host organization through civfix, your{" "}
          <strong>card number, expiry and security code go directly to Stripe</strong>, our payment
          processor, inside an iframe it controls. They never reach civfix&rsquo;s servers and we never
          store them. What we do receive and keep, as part of the donation record, is:
        </p>
        <ul>
          <li>
            the donation amount and currency, the fees, the date and time your card was charged, and
            whether the payment succeeded, failed, was refunded or disputed;
          </li>
          <li>
            the <strong>brand and last four digits</strong> of the card, so a receipt and a later dispute
            can be matched to the right payment;
          </li>
          <li>
            your <strong>email address</strong> (required, so we can send the receipt) and your name if
            you give one;
          </li>
          <li>
            a record of the exact version and content hash of the terms, privacy notice and disclosures
            you were shown when you paid, and whether you opted in to sharing your identity with the
            recipient organization; and
          </li>
          <li>
            the processor&rsquo;s opaque references for the payment, which let us reconcile it and issue
            a receipt.
          </li>
        </ul>
        <p>
          Under California law this is &ldquo;financial information&rdquo;; the amounts and history of
          your donations are also &ldquo;commercial information&rdquo;. We do not use either category to
          profile you, to infer characteristics about you, or for any advertising purpose, and we never
          sell or share it.
        </p>
        <p className="legal-note">
          <strong>Notice at collection.</strong> The donation form itself repeats this in short form at
          the point you enter your details, so you know what is collected and why before you pay.
        </p>

        <h3>Technical, security, and anti-abuse information</h3>
        <ul>
          <li>
            <strong>IP address.</strong> We process your IP address to operate the service securely:
            to enforce rate limits, to run anti-bot challenges, to record the IP associated with a
            session for audit and account-security purposes, and (for anonymous reports) to perform a
            coarse sanity check that the reported location is plausible. This sanity check uses
            approximate, country/region-level location derived from your IP by our network provider; we
            do not use it to pinpoint you.
          </li>
          <li>
            <strong>Anonymous-submission tokens and claim codes.</strong> If you submit without an
            account, we issue a short-lived token and a per-report claim code so you can check the
            report&rsquo;s status and optionally link it to an account later (see Section 6).
          </li>
          <li>
            <strong>Device and log data.</strong> Standard information such as request metadata, app and
            device type, and error diagnostics generated when the service runs or when something goes
            wrong.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> use third-party advertising or analytics trackers inside civfix, we do
          not build advertising profiles, and we do not sell your personal information.
        </p>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <p>We use the information above to:</p>
        <ul>
          <li>
            create and publish your reports, determine the responsible jurisdiction, and forward reports
            to the appropriate government agency;
          </li>
          <li>
            show reports and cleanups on the public map and to your neighbors, and track a report&rsquo;s
            status;
          </li>
          <li>
            operate cleanups, chat, profiles, follows, and notifications, and let you check the status
            of an anonymous report;
          </li>
          <li>
            keep civfix safe by detecting and preventing spam, fraud, duplicate or abusive reports, and
            other misuse, and enforce our Terms;
          </li>
          <li>
            run, maintain, debug, secure, and improve civfix, and back it up so it can be restored; and
          </li>
          <li>comply with the law and respond to lawful requests.</li>
        </ul>
        <p>
          <strong>Legal bases (GDPR / UK GDPR).</strong> Where these laws apply, we rely on the following
          legal bases:
        </p>
        <ul>
          <li>
            <strong>Performance of a contract</strong> - to create your account and provide the features
            you use (publishing and routing your reports, cleanups, chat, profiles, follows, and
            notifications).
          </li>
          <li>
            <strong>Consent</strong> - for push notifications, and for accessing or processing precise
            device location when you choose to use it; you can withdraw consent at any time (in your
            device or app settings) without affecting processing already carried out.
          </li>
          <li>
            <strong>Legitimate interests</strong> - to operate, secure, debug, and improve civfix, to
            prevent spam, fraud, and abuse, and to maintain the public and civic record of reports. Where
            we rely on legitimate interests, you have the right to object (Section 8).
          </li>
          <li>
            <strong>Legal obligation</strong> - to comply with the law and respond to lawful requests; and
            in our or the public&rsquo;s <strong>vital interests</strong> where life or safety is at risk.
          </li>
        </ul>
        <p>
          <strong>Marketing.</strong> The emails and notifications we send today are transactional and
          service-related - sign-in codes, and report, cleanup, and account updates you have opted into.
          If we ever send you promotional or marketing messages, we will rely on your consent where the
          law requires it, and you can object or unsubscribe at any time. Advertising civfix on outside
          platforms (such as social media) does not place any tracking inside civfix.
        </p>
      </section>

      <section>
        <h2>4. How and with whom we share information</h2>
        <ul>
          <li>
            <strong>The public.</strong> Published reports, including the photos/videos, the pin
            location, the category, and your description, are visible on the public map and lists.
            Your profile, the cleanups you host, and your chat messages are visible to the relevant
            audience. Do not include anything in a report or message that you do not want to be public.
          </li>
          <li>
            <strong>Government agencies.</strong> We forward reports to the government body responsible
            for the reported location so the issue can be addressed. We may also share reporter contact
            information with an agency only where appropriate and subject to controls.
          </li>
          <li>
            <strong>Service providers (sub-processors).</strong> We use a small set of vendors to host
            the service, store and deliver media, send email, deliver push notifications, run anti-abuse
            challenges, and serve the map. They process information on our behalf under contract. See our{" "}
            <a href="/legal/subprocessors">Sub-processors</a> list.
          </li>
          <li>
            <strong>Stripe, our payment processor.</strong> Stripe processes donations on our behalf{" "}
            <em>and</em> acts as an <strong>independent controller</strong> in its own right for fraud
            prevention, anti-money-laundering and sanctions screening, and its own legal and regulatory
            obligations. Where Stripe acts as an independent controller, its own privacy notice governs
            and civfix cannot direct or delete that processing. Under the direct-charge model civfix uses,
            the recipient organization is the merchant of record and holds its own relationship with
            Stripe.
          </li>
          <li>
            <strong>The organization you donate to.</strong> It always receives the donation amount, the
            date, and its fee and net figures - it is the recipient of the money. It receives your{" "}
            <strong>name and email address only if you check the optional box</strong> on the donation
            page saying it may know who you are; that box is <strong>off by default</strong>. If you
            leave it off, your donation appears to the organization as an anonymous donation with no
            identifier it could use to work out who you are.
          </li>
          <li>
            <strong>Event hosts.</strong> If you register for an event, the host sees your display name,
            your ticket type and party size, your answers to the host&rsquo;s registration questions, and
            whether you checked in. A host does <strong>not</strong> see your email address or phone
            number unless you registered as a guest without a civfix account, where an email address is
            how the host reaches you. Host messages are <strong>relayed</strong> by civfix rather than
            sent from your address, and we do not track opens or clicks on them.
          </li>
          <li>
            <strong>Legal and safety.</strong> We may disclose information to comply with the law, valid
            legal process, or a lawful request, or to protect the rights, safety, and security of
            civfix, our users, or the public.
          </li>
          <li>
            <strong>Business transfers.</strong> If civfix is involved in a merger, acquisition, or sale
            of assets, information may be transferred as part of that transaction, subject to this
            Policy.
          </li>
        </ul>
        <p>
          <strong>International transfers.</strong> civfix is operated from the United States, and some of
          our providers are located in the United States and other countries, so your information may be
          processed outside your own country. When we transfer the personal information of EEA, UK, or
          Swiss users to a country that has not been recognized as providing an adequate level of
          protection, we use appropriate safeguards - principally the European Commission&rsquo;s{" "}
          <strong>Standard Contractual Clauses</strong> (and, for transfers from the UK, the UK{" "}
          <strong>International Data Transfer Addendum</strong>), together with the{" "}
          <strong>EU-US / UK Extension / Swiss-US Data Privacy Framework</strong> where the receiving
          provider is certified. You can request a copy of the safeguards we rely on by emailing us at the
          address in Section 11.
        </p>
      </section>

      <section>
        <h2>5. Where information is stored, and security</h2>
        <p>
          The primary civfix database and application are hosted with our cloud infrastructure provider;
          report photos and videos are stored on object storage and delivered through a content delivery
          network. We protect information with measures including encryption in transit, scoped access,
          rate limiting and abuse controls, isolation of untrusted media processing, metadata stripping,
          and encrypted backups used for disaster recovery. Our error-tracking system is self-hosted on
          our own infrastructure rather than a third-party analytics vendor. No method of storage or
          transmission is perfectly secure, so we cannot guarantee absolute security.
        </p>
        <p>
          For the small set of cookies and on-device storage civfix uses - all of it strictly necessary
          or a first-party preference, with no advertising or cross-site tracking - and why we show no
          consent banner, see our <a href="/legal/cookies">Cookies &amp; Storage</a> notice.
        </p>
      </section>

      <section>
        <h2>6. Anonymous reports and what &ldquo;anonymous&rdquo; means</h2>
        <p>
          You can report without an account. An anonymous report is not tied to a civfix profile and we
          do not attach your name or email to it. However:
        </p>
        <ul>
          <li>
            we issue a short-lived token and a per-report <strong>claim code</strong> so you can check
            its status and, if you choose, link the report to an account later, which makes the report{" "}
            <strong>retroactively linkable</strong> to you;
          </li>
          <li>
            we still process technical information such as your IP address for security and the
            location sanity check described above; and
          </li>
          <li>anonymous reports remain subject to valid legal process.</li>
        </ul>
        <p>
          If you want a report to stay unlinked, do not enter its claim code into an account and do not
          include identifying details in the description or media.
        </p>
      </section>

      <section>
        <h2>7. Data retention</h2>
        <p>
          We retain personal information indefinitely by default, for as long as it remains useful to
          provide civfix, to maintain the public and civic record of reports, and to meet our legal and
          operational needs. In particular:
        </p>
        <ul>
          <li>
            account information is retained while your account is active and afterward, unless and until
            you ask us to delete it;
          </li>
          <li>
            published reports and their media are retained as part of the public record and because they
            have been forwarded to or relied on by an agency, including after you delete your account;
          </li>
          <li>
            cleanup chat history, notifications, and security and log data are retained for as long as
            they remain useful for operating and securing civfix; and
          </li>
          <li>
            never-attached media uploads are automatically swept and deleted shortly after upload.
          </li>
        </ul>
        <p>
          The table below gives the specific period, or the criteria we use to work one out, for each
          category of personal information - as California law requires us to state.
        </p>
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">How long we keep it</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_ROWS.map((r) => (
                <tr key={r.category}>
                  <th scope="row" style={{ textAlign: "left", fontWeight: 700 }}>
                    {r.category}
                  </th>
                  <td>{r.period}</td>
                  <td>{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          You can ask us to delete your account and request takedown of a report you submitted, as
          described in Section 8. We honor deletion requests as required by law, subject to the
          public-record and legal-retention exceptions above and in the table.
        </p>
      </section>

      <section>
        <h2>8. Your rights and choices</h2>
        <p>
          Depending on where you live, you have rights over your personal information. If you are in the
          EEA, the UK, or Switzerland, the GDPR and UK GDPR give you the rights below; we also make the
          core of these rights available to everyone as a matter of practice, not only where a particular
          law strictly requires it:
        </p>
        <ul>
          <li>
            <strong>Access and portability.</strong> Request a copy of the personal information associated
            with your account, in a portable format.
          </li>
          <li>
            <strong>Rectification.</strong> Correct information that is inaccurate or incomplete; you can
            edit much of your profile directly in the app.
          </li>
          <li>
            <strong>Erasure.</strong> Delete your account, and request takedown of a report you submitted.
            Some content that has been published or forwarded to an agency may be retained as part of the
            public and civic record described in Section 7, and we may retain limited information where the
            law allows or requires it.
          </li>
          <li>
            <strong>Erasure and donations - what we can and cannot delete.</strong> Deleting your account
            immediately <strong>unlinks your profile</strong> from any donation you made: the donation
            record stops pointing at your account and stops appearing in your donation history. The{" "}
            <strong>financial record itself is kept for seven years</strong> from the charge date, under
            the exceptions for legal obligations and the establishment or defence of legal claims (GDPR
            Article 17(3)(b) and (e); Civil Code section 1798.105(d)). The email address and name on that
            record are removed at the end of the seven years, leaving only a pseudonymous financial entry.
            Separately, civfix cannot delete a payment record held by{" "}
            <strong>Stripe or by the recipient organization</strong>: Stripe keeps its own records as an
            independent controller with its own legal obligations, and the organization is the merchant
            of record for the payment. Contact them directly for their own records.
          </li>
          <li>
            <strong>Restriction.</strong> Ask us to limit how we use your information while a request is
            being resolved.
          </li>
          <li>
            <strong>Objection.</strong> Object to processing we carry out on the basis of our legitimate
            interests. You can object to direct marketing at any time, and we will stop.
          </li>
          <li>
            <strong>Withdraw consent.</strong> Where we rely on your consent (for example push
            notifications or precise location), withdraw it at any time without affecting prior
            processing.
          </li>
          <li>
            <strong>Notifications and location controls.</strong> Turn push notifications on or off, and
            control whether you share precise location when you create a report (through your device and
            the choices in the report flow).
          </li>
        </ul>
        <p>
          We do not make decisions about you that produce legal or similarly significant effects based
          solely on automated processing. To exercise a right, email{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>; we respond within the timeframes
          the law requires (generally within one month under the GDPR/UK GDPR). We will not discriminate
          against you for exercising your rights, and we do not sell or &ldquo;share&rdquo; personal
          information for cross-context behavioral advertising as those terms are defined under US state
          privacy laws.
        </p>
        <p>
          <strong>EEA / UK data-protection contact and complaints.</strong> For any privacy matter, EEA
          and UK users can contact <strong>Roman Aytur</strong> at{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>. Because civfix is operated from
          outside the EEA and the UK, we are also appointing a representative established in the European
          Union and in the United Kingdom under Article 27 of the GDPR / UK GDPR; we will publish that
          representative&rsquo;s name and contact details here. You also have the right to lodge a complaint
          with your local data protection authority - in the UK, the Information Commissioner&rsquo;s Office
          (ICO) - though we hope you will contact us first so we can help.
        </p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>
          civfix is a general-audience service and is not directed to children. You must be at least 13 to
          use civfix (see our <a href="/legal/terms">Terms of Service</a>), and we do not knowingly collect
          personal information from a child under that age. In parts of the EEA, the GDPR allows a member
          state to set the age for consenting to online services anywhere between 13 and 16; in the UK it
          is 13. If you are in a country that sets a higher age, you may use civfix only if you meet that
          age or have the consent of a holder of parental responsibility. If you believe a child below the
          applicable age has provided us personal information, contact us and we will delete it.
        </p>
      </section>

      <section>
        <h2>10. Changes to this Policy</h2>
        <p>
          We may update this Policy. When we make material changes, we will update the &ldquo;Last
          updated&rdquo; date and, where appropriate, provide additional notice. Your continued use of
          civfix after the changes take effect means you accept the updated Policy.
        </p>
      </section>

      <section>
        <h2>11. Contact us</h2>
        <p>
          The data controller is <strong>Reach Out Los Angeles</strong>, a California 501(&zwnj;c)(3)
          nonprofit. For privacy questions or to exercise any of the rights in Section 8, contact{" "}
          <strong>Roman Aytur</strong> at <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>.
          EEA and UK users have additional contact and complaint options in Section 8.
        </p>
      </section>
    </LegalPage>
  )
}
