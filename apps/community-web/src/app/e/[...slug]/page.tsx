import { SignupView } from "@/features/signup-page/signup-view"

export function generateStaticParams(): Array<{ slug: string[] }> {
  return [{ slug: ["_"] }]
}

export const dynamicParams = false

export default function SignupPage() {
  return <SignupView />
}
