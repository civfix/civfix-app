/** Pure CSS-transition builders over the shared motion vocabulary: no RN and no DOM, so unit-testable. */
import type { TimingRecipe } from "../theme/motion"
import { EASE_STANDARD_CSS } from "../theme/motion"

export function cssTransition(props: readonly string[], r: TimingRecipe): string {
  return cssTransitionParts(props.map((p) => [p, r.duration]))
}

export function cssTransitionParts(parts: ReadonlyArray<[string, number]>): string {
  return parts.map(([p, d]) => `${p} ${d}ms ${EASE_STANDARD_CSS}`).join(", ")
}
