export interface NativeShareInput {
  title: string
  message?: string
  url: string
}

export interface NativeShareContent {
  title: string
  message: string
  url: string
}

export function nativeShareContent(os: string, input: NativeShareInput): NativeShareContent {
  const text = input.message ?? input.title
  const message = os === "android" && !text.includes(input.url) ? `${text}\n${input.url}` : text
  return { title: input.title, message, url: input.url }
}
