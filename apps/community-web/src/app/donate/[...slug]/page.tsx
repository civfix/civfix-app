import type { Metadata } from "next"

import { DonateView } from "@/features/donate/donate-view"

import "../donate.css"

export const metadata: Metadata = {
  title: "Donate · civfix",
  description: "Donate to a verified nonprofit organization through civfix.",
  robots: { index: false, follow: false },
}

export function generateStaticParams(): Array<{ slug: string[] }> {
  return [{ slug: ["_"] }]
}

export const dynamicParams = false

export default function DonatePage() {
  return (
    <>
      <noscript>
        <div className="donate-page">
          <div className="donate-shell donate-state">
            <h1>JavaScript is required to donate</h1>
            <p>
              The donation form is drawn by our payment processor and cannot run without JavaScript.
              Enable it and reload this page, or see{" "}
              <a href="/legal/donations">how donations through civfix work</a>.
            </p>
          </div>
        </div>
      </noscript>
      <DonateView />
    </>
  )
}
