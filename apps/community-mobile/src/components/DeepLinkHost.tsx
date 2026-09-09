import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import { useRouter, type Href } from "expo-router"
import { goHome, shimNavPlan } from "@/lib/goHome"
import { makeThemedStyles } from "@/theme"

export interface DeepLinkHostProps {
  seed?: () => void
  to?: Href
  deps?: React.DependencyList
}

export default function DeepLinkHost({ seed, to, deps = [] }: DeepLinkHostProps): React.JSX.Element {
  const router = useRouter()
  const styles = useStyles()
  const seedRef = useRef(seed)
  seedRef.current = seed
  const toRef = useRef(to)
  toRef.current = to

  useEffect(() => {
    seedRef.current?.()
    const plan = shimNavPlan(toRef.current)
    if (plan.type === "home") goHome(router)
    else router.replace(plan.href)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, router])

  return <View style={styles.host} />
}

const useStyles = makeThemedStyles((t) => ({
  host: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
}))
