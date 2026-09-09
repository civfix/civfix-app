import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your profile · civfix",
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
