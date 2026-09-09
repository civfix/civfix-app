import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Messages · civfix",
}

export default function L({ children }: { children: React.ReactNode }) {
  return children
}
