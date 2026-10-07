export function personPostsListed({
  loading,
  error,
  postItems,
}: {
  loading: boolean
  error: boolean
  postItems: readonly unknown[]
}): boolean {
  return !loading && !error && postItems.length > 0
}
