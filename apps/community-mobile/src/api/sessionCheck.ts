import type { SessionCheckResponse } from "@civfix/shared"
import { api } from "@/api/client"
import { sharedDeadlineRequest } from "@/api/deadline"
import { tokenGeneration } from "@/auth/storage"

// The boot restore and the loading gate's sign-in provider list both read the session at launch;
// sharing the in-flight request sends one GET instead of two identical ones. A token write in between
// starts a fresh request, so no caller adopts an answer sent under the previous credential.
export const sessionCheck: (deadlineMs: number) => Promise<SessionCheckResponse> =
  sharedDeadlineRequest((signal) => api.session({ signal }), tokenGeneration)
