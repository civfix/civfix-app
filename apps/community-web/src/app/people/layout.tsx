import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "People · civfix",
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
