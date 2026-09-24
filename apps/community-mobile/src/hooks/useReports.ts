import type { ReverseLabelResponse } from "@civfix/shared"
import { api } from "@/api/client"

// The server answers an unplaceable point with an empty or whitespace label; trimming lets callers treat
// empty as "no result" instead of writing whitespace into the form.
export async function reverseLabel(lat: number, lng: number): Promise<ReverseLabelResponse> {
  const res = await api.reverseLabel({ lat, lng })
  return { ...res, cityStateLabel: res.cityStateLabel?.trim() ?? "" }
}
