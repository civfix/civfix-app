import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service · civfix",
  description: "The terms that govern your use of civfix.",
}

export default function TermsPage() {
  return (
    <LegalPage active="terms" title="Terms of Service" intro="The agreement between you and civfix">
      <section>
        <h2>1. Who we are and what these terms cover</h2>
        <p>
          civfix is a service that lets neighbors report local issues (illegal dumping, graffiti,
          potholes and broken sidewalks, broken streetlights, flooding and other hazards, overgrown
          brush, and similar problems) by dropping a pin on a map and attaching a photo or short
          video. civfix works out which government jurisdiction is responsible for the exact spot and
          can forward the report to it. civfix also lets people organize and join neighborhood cleanups
          and coordinate with each other.
        </p>
        <p>
          civfix is available as a native app for iOS and Android and as a web app in your browser.
          These Terms of Service (the &ldquo;Terms&rdquo;) are a binding agreement between you and{" "}
          <strong>Reach Out Los Angeles</strong>, a registered 501(&zwnj;c)(3) nonprofit organization that
          operates civfix (&ldquo;Reach Out Los Angeles,&rdquo; &ldquo;civfix,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By creating an account, submitting
          a report, or otherwise using civfix, you agree to these Terms and to our{" "}
          <a href="/legal/privacy">Privacy Policy</a>, which is incorporated here by reference. If you
          do not agree, do not use civfix.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and accounts</h2>
        <p>
          You must be at least 13 years old to use civfix. civfix is not directed to children under 13,
          and we do not knowingly permit anyone under 13 to create an account or submit a report. By
          using civfix you confirm that you are 13 or older. If you are in a country that sets a higher
          minimum age for consenting to online services (in parts of the European Economic Area this is
          up to 16; in the United Kingdom it is 13), you may use civfix only if you meet that age or have
          the consent of a holder of parental responsibility. See the{" "}
          <a href="/legal/privacy">Privacy Policy</a> for how this affects the personal information we
          process.
        </p>
        <p>
          You can use much of civfix without an account, including submitting reports anonymously (see
          Section 5). To follow your reports over time, host or join cleanups, use chat, or follow
          other people, you create an account by signing in with a third-party identity provider (for
          example Google or Apple). We do not store passwords. You are responsible for keeping access to
          your sign-in provider secure and for all activity under your account. Sessions remain valid
          for a limited period and we may revoke them at any time (for example for security reasons or
          for a breach of these Terms).
        </p>
      </section>

      <section>
        <h2>3. What civfix is and is not</h2>
        <p>
          civfix is a tool that helps you route a report to the government body responsible for a
          location and helps neighbors organize. civfix is <strong>not</strong> an emergency service,
          a government agency, or a guarantee that any issue will be reviewed, accepted, acted on, or
          resolved by any agency or by anyone else.
        </p>
        <p>
          <strong>
            If you are reporting an emergency or a situation that threatens life, safety, or property,
            contact your local emergency services (such as 911 in the United States). Do not rely on
            civfix.
          </strong>
        </p>
        <p>
          Jurisdiction routing is based on geographic data and is provided on a best-effort basis. The
          responsible agency, the agency&rsquo;s contact information, and whether and how it responds
          are outside our control. We may forward a report to a public agency, publish it on the public
          map, hold it for review, or decline to publish or forward it.
        </p>
      </section>

      <section>
        <h2>4. Your content and the license you grant</h2>
        <p>
          &ldquo;Your Content&rdquo; means everything you submit to civfix: report photos and videos,
          the location (pin) you choose, descriptions, cleanup details, chat messages, profile
          information, and anything else you provide. You keep ownership of Your Content.
        </p>
        <p>
          Because civfix exists to forward reports to the responsible authorities and to show them to
          your neighbors, you grant civfix a worldwide, non-exclusive, royalty-free license to host,
          store, reproduce, adapt (for example to create thumbnails, strip metadata, and re-encode
          video), publish, display, and distribute Your Content for the purpose of operating, providing,
          and improving civfix, including forwarding reports to government agencies and displaying
          public reports and cleanups on the map. This license continues for content that remains
          public or that has been forwarded to or relied on by a third party, even after you delete
          your account, to the extent needed for civfix to operate and to keep an accurate public record.
        </p>
        <p>You represent and warrant that, for everything you submit:</p>
        <ul>
          <li>you have the rights necessary to submit it and to grant the license above; and</li>
          <li>
            it does not violate any law or any third party&rsquo;s rights (including privacy,
            publicity, and intellectual-property rights).
          </li>
        </ul>
        <p>
          Reports and the media attached to them are publicly visible once published. Be thoughtful
          about capturing bystanders, faces, license plates, the interiors of homes, or anything else
          that could identify or embarrass a person. Do not photograph people in a way that is
          harassing or that they would reasonably expect to be private.
        </p>
      </section>

      <section>
        <h2>5. Anonymous reports</h2>
        <p>
          You can submit a report without an account. We call this an &ldquo;anonymous&rdquo; report
          because it is not tied to a civfix profile. You should understand what that does and does not
          mean:
        </p>
        <ul>
          <li>
            An anonymous report is not linked to a civfix account, and we do not attach your name or
            email to it.
          </li>
          <li>
            To submit anonymously and to let you check the status of your report later, we issue a
            short-lived token and a per-report <strong>claim code</strong>. If you later create an
            account and enter that claim code, the report becomes linked to your account. In that sense
            an anonymous report can be made <strong>retroactively linkable</strong> to you.
          </li>
          <li>
            As with any online submission, we process technical information such as your IP address to
            prevent abuse and to perform basic location sanity checks, as described in the{" "}
            <a href="/legal/privacy">Privacy Policy</a>.
          </li>
          <li>
            Anonymous reports remain subject to lawful requests. We will respond to valid legal process
            in accordance with our policies and applicable law.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>submit false, misleading, fraudulent, or deliberately duplicate reports;</li>
          <li>
            upload content that is unlawful, defamatory, harassing, hateful, threatening, sexually
            explicit, or that depicts or exploits minors;
          </li>
          <li>
            harass, stalk, dox, impersonate, or threaten any person, including through chat, profiles,
            follows, or reports;
          </li>
          <li>
            submit content that infringes intellectual-property rights or that you do not have the
            right to submit;
          </li>
          <li>
            attempt to defeat, probe, or interfere with civfix&rsquo;s security, rate limits, abuse
            controls, anti-bot challenges, or the systems of our service providers, or attempt to
            access data that is not yours;
          </li>
          <li>
            scrape, harvest, or bulk-collect data from civfix, or use automated means to submit content,
            except as we expressly permit;
          </li>
          <li>
            misuse the location features (for example by deliberately falsifying where an issue is), or
            use civfix to surveil or target an individual; or
          </li>
          <li>use civfix to break any law or to facilitate anyone else doing so.</li>
        </ul>
        <p>
          We use automated and manual abuse controls (including anti-bot challenges, rate limits,
          duplicate detection, and content checks). Reports, especially anonymous ones, may be held
          for review before they are published. We may remove content, take down a report, restrict
          features, or suspend or terminate accounts that violate these Terms or that we reasonably
          believe are abusive, at our discretion.
        </p>
      </section>

      <section>
        <h2>7. Cleanups, chat, and interactions with others</h2>
        <p>
          civfix lets anyone host a cleanup and lets others RSVP and coordinate in a group chat tied to
          that cleanup. You are responsible for your own safety and conduct at any event and for your
          messages and interactions with other people. civfix does not vet, endorse, or supervise
          cleanups, organizers, or attendees, and is not responsible for what happens at an event or in
          a conversation arranged through civfix. Use common sense and follow all applicable laws and
          local rules.
        </p>
      </section>

      <section>
        <h2>8. Donations through civfix</h2>
        <p>
          Some verified nonprofit host organizations can accept donations through civfix. When you
          donate,{" "}
          <strong>
            the host organization is the recipient of your donation and the merchant of record
          </strong>
          . civfix acts only as the organization&rsquo;s authorized agent to solicit and facilitate the
          payment. Your card is charged directly on that organization&rsquo;s own account with our
          payment processor, Stripe; the money never enters a civfix bank account or balance, and civfix
          never holds, pools, or disburses donated funds.
        </p>
        <p>
          Because civfix collects the payment as the organization&rsquo;s authorized agent,{" "}
          <strong>
            your payment to civfix satisfies your obligation to the recipient organization
          </strong>{" "}
          to the extent of the amount you paid, whether or not civfix or the processor subsequently
          remits it. If a donation cannot be delivered to the organization you chose - for example if it
          loses its good standing before the payment settles - we will tell you and refund it.
        </p>
        <p>
          A donation is a voluntary contribution, not a purchase. You receive no goods or services in
          exchange, and you must be authorized to use the payment method you provide. We may refuse or
          reverse a donation we reasonably believe is fraudulent, unlawful, or made with a payment
          method you are not authorized to use.
        </p>
        <p>
          civfix is not a charity that is soliciting for itself when it hosts these pages. Whether a
          donation is tax-deductible depends entirely on the recipient organization&rsquo;s own tax
          status, which we display on the donation page along with the date we last verified it against
          public records. We do not give tax advice.
        </p>
      </section>

      <section>
        <h2>9. Fees on donations</h2>
        <p>
          civfix charges a <strong>platform fee of 5% of the donation amount</strong>. Separately, the
          payment processor charges the recipient organization its own card-processing fee. Both are
          itemized on the donation page, with the estimated amount the organization receives,{" "}
          <strong>before</strong> you enter any payment details and before you pay. We will never tell
          you that 100% of your donation reaches the organization, because that would not be true.
        </p>
        <p>
          The processing fee shown before payment is an estimate: the exact amount depends on the card
          and method you use and is set by the processor, not by us. The exact figures appear on your
          receipt.
        </p>
        <p>
          <strong>Refundability of the platform fee:</strong> if a donation is refunded in full or in
          part, civfix reverses its 5% platform fee proportionally, so you are not charged a civfix fee
          on money you got back. The payment processor&rsquo;s own fee is generally retained by the
          processor on a refunded payment; that is the processor&rsquo;s policy, not a civfix charge, and
          it is borne by the recipient organization rather than by you.
        </p>
      </section>

      <section>
        <h2>10. Refunds</h2>
        <p>
          Donations are <strong>non-refundable</strong> except where the law requires a refund or where
          the recipient organization chooses to issue one. The recipient organization controls refunds
          for its own donations, because it is the merchant of record; civfix cannot issue a refund on
          its behalf. To request one, contact the organization first. If you believe a charge was
          unauthorized or fraudulent, contact us at{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a> and we will help you reach the
          organization and, where appropriate, act on our own.
        </p>
        <p>
          If a donation is refunded, the platform fee is reversed proportionally as described in Section
          9. Refunds are returned to the original payment method.
        </p>
      </section>

      <section>
        <h2>11. Terms for host organizations that accept donations</h2>
        <p>
          If you connect an organization to civfix to receive donations, these additional terms apply to
          you and to that organization, and you confirm you are authorized to accept them on its behalf.
        </p>
        <ul>
          <li>
            <strong>Processor agreement.</strong> You accept the Stripe Connected Account Agreement
            (including the Stripe Services Agreement) directly with Stripe during onboarding. That
            agreement is between the organization and Stripe; civfix is not a party to it and cannot vary
            it.
          </li>
          <li>
            <strong>Eligibility and notice.</strong> The organization represents that it is a tax-exempt
            organization in good standing under Internal Revenue Code section 501(c)(3), registered and
            in good standing where its solicitation requires registration, and not on any list barring it
            from soliciting. You must notify civfix{" "}
            <strong>within five business days</strong> of losing, or being notified you may lose, any of
            that status. We re-verify against public records on a schedule and will suspend donations
            immediately if the organization ceases to be in good standing.
          </li>
          <li>
            <strong>Merchant of record.</strong> The organization is the merchant of record for every
            donation it receives. It is solely responsible for its own tax reporting (including any Form
            1099-K issued to it by the processor), for its donors&rsquo; substantiation, for chargebacks
            and disputes, and for any refunds it chooses to give. Chargeback and refund amounts, and the
            processor fees on them, are borne by the organization.
          </li>
          <li>
            <strong>Receipts.</strong> You authorize civfix to issue donation receipts and
            acknowledgments to donors <strong>on the organization&rsquo;s behalf and in its name</strong>
            , using the legal name, address and employer identification number shown in public tax
            records, and to state on those receipts whether the donation is tax-deductible. You remain
            responsible for the accuracy of your own tax status.
          </li>
          <li>
            <strong>Fees.</strong> The organization agrees to the platform fee disclosed to it when it
            enabled donations. We will not raise that fee without giving you notice and asking you to
            accept a new version of this agreement; until you do, we charge the rate you already
            accepted.
          </li>
          <li>
            <strong>Suspension.</strong> civfix may suspend or disable an organization&rsquo;s donation
            page at any time - including immediately and without notice - if it loses good standing, if
            the processor disables its account, if we are directed to by a regulator, or if we
            reasonably suspect fraud or misuse.
          </li>
        </ul>
      </section>

      <section>
        <h2>12. Receipts and acknowledgments</h2>
        <p>
          civfix sends a receipt for every completed donation, by email, as the recipient
          organization&rsquo;s authorized agent, normally within minutes and in any case{" "}
          <strong>within five business days</strong>. The receipt names the recipient organization, the
          amount, the date your card was charged, whether the donation is tax-deductible and to what
          extent, and an itemization of the fees. It contains no promotional content.
        </p>
        <p>
          For a single donation of <strong>$250 or more</strong>, US tax law requires you to hold a
          contemporaneous written acknowledgment from the charity in order to claim a deduction; the
          receipt civfix issues on the organization&rsquo;s behalf is intended to serve that purpose, and
          you should keep it. We do not give tax advice; consult your own advisor.
        </p>
      </section>

      <section>
        <h2>13. Messages from event hosts</h2>
        <p>
          If you register for an event, the host can send you messages about that event - confirmations,
          reminders, changes, and updates - through civfix, by push notification and by email. Those
          messages are relayed by civfix: the host does not receive your email address or phone number
          unless you separately choose to share it.
        </p>
        <p>
          Hosts may use this only for their own event. Advertising, fundraising appeals unrelated to the
          event, political campaigning, selling or renting the list, and any message unrelated to the
          event you signed up for are prohibited, and we enforce message limits per event. Every host
          message carries a one-click unsubscribe that takes effect immediately for that event; you can
          also mute an event from the app. Transactional messages you cannot switch off - a cancellation
          notice, for instance - are limited to what you need to know about an event you are registered
          for.
        </p>
        <p>
          As an attendee you are also giving the host limited information about yourself: your display
          name, the ticket type and party size you chose, your answers to the host&rsquo;s registration
          questions, and whether you checked in. Hosts must use that only to run the event, must keep it
          confidential, and must not sell it or use it for unrelated marketing. Your email address and
          phone number are not shown to a host unless you gave them to the host directly - for example by
          signing up as a guest without a civfix account, where an email address is how the host reaches
          you.
        </p>
      </section>

      <section>
        <h2>14. Third-party services</h2>
        <p>
          civfix relies on third-party providers to operate, for example for sign-in, hosting, media
          storage and delivery, maps, email, and push notifications. Your use of those features may also
          be subject to the third party&rsquo;s terms. The map basemap is provided by OpenStreetMap
          contributors and CARTO and is used under their terms and attribution requirements. We are not
          responsible for third-party services. The providers that process personal data on our behalf
          are listed in our <a href="/legal/subprocessors">Sub-processors</a> list.
        </p>
      </section>

      <section>
        <h2>15. Intellectual property in civfix</h2>
        <p>
          civfix, including its software, design, brand, and the &ldquo;civfix&rdquo; name and logo, is
          owned by us and our licensors and is protected by intellectual-property laws. These Terms do
          not grant you any right to our trademarks, branding, or software except the limited right to
          use civfix as intended. Map data and tiles are © OpenStreetMap contributors and © CARTO.
        </p>
      </section>

      <section>
        <h2>16. Disclaimers</h2>
        <p>
          civfix is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
          <strong>&ldquo;as available,&rdquo;</strong> without warranties of any kind, whether express,
          implied, or statutory, including any implied warranties of merchantability, fitness for a
          particular purpose, title, and non-infringement, and any warranty arising from a course of
          dealing or usage of trade. We do not warrant that civfix will be uninterrupted, secure,
          error-free, or that any report will reach, be accepted by, or be acted on by any agency or
          person. civfix runs on a single-region infrastructure with a rebuild-from-backup recovery
          model and no high-availability guarantee; we do not promise any particular level of uptime.
        </p>
      </section>

      <section>
        <h2>17. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, civfix and its operators, owners, employees, and
          providers will not be liable for any indirect, incidental, special, consequential, exemplary,
          or punitive damages, or for any loss of data, profits, revenue, goodwill, or for any damages
          arising from your use of (or inability to use) civfix, from any content, from any agency&rsquo;s
          action or inaction, or from any interaction with other users or at any cleanup. To the maximum
          extent permitted by law, our total aggregate liability for all claims relating to civfix will
          not exceed the greater of the amount you paid us to use civfix in the twelve months before the
          claim (civfix is currently free) or US $100. Some jurisdictions do not allow certain of these
          limitations, so some may not apply to you.
        </p>
      </section>

      <section>
        <h2>18. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless civfix and its operators and providers from any
          claims, damages, liabilities, and expenses (including reasonable legal fees) arising out of
          your content, your use of civfix, or your violation of these Terms or of any law or any third
          party&rsquo;s rights.
        </p>
      </section>

      <section>
        <h2>19. Changes, suspension, and termination</h2>
        <p>
          We may change, suspend, or discontinue any part of civfix at any time. We may update these
          Terms; when we make material changes we will update the &ldquo;Last updated&rdquo; date and,
          where appropriate, provide additional notice. Your continued use of civfix after changes take
          effect means you accept the updated Terms. You may stop using civfix and delete your account at
          any time; certain provisions (for example the license for content that remains public,
          disclaimers, limitation of liability, and indemnification) survive termination.
        </p>
      </section>

      <section>
        <h2>20. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the State of California, without regard to its
          conflict-of-laws rules, and you and we submit to the exclusive jurisdiction of the state and
          federal courts located in Los Angeles County, California for any dispute, except where
          applicable law gives you the right to bring a claim elsewhere.
        </p>
        <p>
          <strong>If you are a consumer in the European Economic Area or the United Kingdom,</strong> this
          choice of law and forum does not deprive you of the protection of the mandatory consumer-protection
          laws of your country of residence, and you may bring proceedings in the courts of that country.
          Nothing in these Terms (including the disclaimers in Section 16 and the liability limits in
          Section 17) limits or excludes any right or remedy you have under that mandatory law, or any
          liability that cannot lawfully be limited or excluded. Your data-protection rights are described
          in the <a href="/legal/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>21. Miscellaneous</h2>
        <p>
          These Terms, together with the Privacy Policy, are the entire agreement between you and us
          about civfix. If any provision is found unenforceable, the rest stays in effect. Our failure
          to enforce a provision is not a waiver. You may not assign these Terms; we may assign them in
          connection with a merger, acquisition, or sale of assets.
        </p>
      </section>

      <section>
        <h2>22. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:roman@reachoutla.org">roman@reachoutla.org</a>.
        </p>
      </section>
    </LegalPage>
  )
}
