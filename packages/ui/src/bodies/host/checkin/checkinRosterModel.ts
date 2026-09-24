export function checkinRosterListed(
  roster: { isLoading: boolean; isError: boolean },
  rows: readonly unknown[],
): boolean {
  return !roster.isLoading && !roster.isError && rows.length > 0
}
