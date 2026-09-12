let seen = false

export function rootShellSeen(): boolean {
  return seen
}

export function markRootShellSeen(): void {
  seen = true
}
