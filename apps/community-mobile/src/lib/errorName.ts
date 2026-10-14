// Only the error's name is logged: its message can carry keychain paths or a notification payload.
export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : typeof err
}
