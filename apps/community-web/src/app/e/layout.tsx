import type { Metadata } from "next"

import "./signup.css"

export const metadata: Metadata = {
  title: "Event · civfix",
  description: "Sign up for a civfix event.",
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
