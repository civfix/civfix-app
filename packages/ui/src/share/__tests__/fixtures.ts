import type { PersonDTO } from "@civfix/shared"

export const person = (id: string, over: Partial<PersonDTO> = {}): PersonDTO => ({
  id,
  name: `Name ${id}`,
  handle: id,
  avatar: null,
  avatarUrl: null,
  followers: 0,
  following: 0,
  isFollowing: false,
  ...over,
})
