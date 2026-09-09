/**
 * Shared React Query hooks for chat GROUPS (P4 Task 4.6) - the management surface of a user-created
 * group room (`chat_groups`). The group's MESSAGES ride the unified chat rails (`useChat(id, "group")`
 * pages GET /groups/:id/messages via the roomKind dispatch in ./chat.ts); these hooks cover everything
 * else: create, info, roster, updates and membership.
 *
 * Framework-light like the rest of the data seam: host API client + auth via the injected context, the
 * SHARED queryKeys, no navigation (bodies own that). Cache families touched:
 *   - queryKeys.groupInfo(id)     - the ChatGroupDTO (name/description/avatar/visibility/memberCount/myRole).
 *   - queryKeys.groupMembers(id)  - the cursor-infinite member roster; nested under groupInfo's prefix so
 *                                   invalidating `["group", id]` refreshes info + roster together.
 *   - queryKeys.threads           - the inbox list (a group appears there as a kind:"group" thread), so
 *                                   creating a group / renaming it / changing membership refreshes the row.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AddGroupMembersRequest,
  ChatGroupDTO,
  CreateChatGroupRequest,
  GroupMemberDTO,
  ListGroupMembersResponse,
  RemoveGroupMemberRequest,
  SetGroupMemberRoleRequest,
  UpdateChatGroupRequest,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

const GROUP_MEMBERS_PAGE_SIZE = 30

/**
 * Create a group (POST /groups). On success the fresh DTO seeds `groupInfo(id)` (the wizard navigates
 * straight into the new room, so its header/info read warm) and the inbox thread list refreshes (the
 * new group must appear there immediately). The caller navigates from `onSuccess`/`mutate` callbacks.
 */
export function useCreateGroup() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ChatGroupDTO, unknown, CreateChatGroupRequest>({
    mutationFn: (input) => api.createChatGroup(input),
    onSuccess: (group) => {
      qc.setQueryData<ChatGroupDTO>(queryKeys.groupInfo(group.id), group)
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

/**
 * Self-serve join a PUBLIC group / channel (POST /groups/:id/join, P5 Task 5.4). The mutation variable
 * is the group id; the server 403s (not_public) for a private group. On success the returned DTO
 * settles `groupInfo(id)` directly (so the viewer's `myRole` flips off null -> "member" and the channel
 * composer slot's join pill becomes the mute pill) and the inbox thread list refreshes (the joined room
 * should appear there immediately, mirroring useJoinReportChat). The MEMBER ROSTER is invalidated so the
 * new member shows up in it; `groupInfo(id)` itself deliberately is NOT (the response is authoritative,
 * and invalidating the key we just seeded would only refetch it away - matching useCreateGroup/useUpdateGroup).
 */
export function useJoinGroup() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ChatGroupDTO, unknown, string>({
    mutationFn: (id) => api.joinChatGroup({ id }),
    onSuccess: (group) => {
      qc.setQueryData<ChatGroupDTO>(queryKeys.groupInfo(group.id), group)
      void qc.invalidateQueries({ queryKey: queryKeys.groupMembers(group.id) })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

/**
 * A group's management DTO (GET /groups/:id, auth required). Pass `undefined` to keep the query
 * disabled (the ConversationBody calls this only for roomKind "group" rooms). `myRole` on the result
 * drives the client-side moderation gates (chatPowers) and the member-management affordances.
 */
export function useGroupInfo(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ChatGroupDTO>({
    queryKey: queryKeys.groupInfo(id ?? ""),
    enabled: isAuthenticated && !!id,
    queryFn: () => api.getChatGroup({ id: id ?? "" }),
    retry: false,
    staleTime: 30_000,
  })
}

/**
 * The group's member roster (GET /groups/:id/members), cursor-infinite. Pass `undefined` to keep the
 * query disabled (MembersBody is roomKind-dispatched). Pages carry `{ members: GroupMemberDTO[] }`
 * (user + role + joinedAt), so the roster can badge owner/admin rows.
 */
export function useGroupMembers(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListGroupMembersResponse>({
    queryKey: queryKeys.groupMembers(id ?? ""),
    enabled: isAuthenticated && !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listGroupMembers({
        id: id ?? "",
        ...(pageParam ? { cursor: pageParam as string } : {}),
        limit: GROUP_MEMBERS_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

/**
 * Patch the group's identity/settings (PATCH /groups/:id - set-only fields; clearing the description
 * is an empty string). On success the returned DTO settles `groupInfo(id)` directly and the inbox
 * refreshes (the thread row renders the group name).
 */
export function useUpdateGroup() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ChatGroupDTO, unknown, UpdateChatGroupRequest>({
    mutationFn: (input) => api.updateChatGroup(input),
    onSuccess: (group) => {
      qc.setQueryData<ChatGroupDTO>(queryKeys.groupInfo(group.id), group)
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

/**
 * Add members (POST /groups/:id/members, owner/admin only - server enforced). Invalidates the whole
 * `["group", id]` prefix (roster pages + the info's memberCount) and the inbox (its "{N} members" sub
 * line). The response is the refreshed first roster page, but the cursor-paged cache is simplest to
 * refetch than splice.
 */
export function useAddGroupMembers() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ListGroupMembersResponse, unknown, AddGroupMembersRequest>({
    mutationFn: (input) => api.addGroupMembers(input),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.groupInfo(vars.id) })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

/**
 * Remove a member / leave (DELETE /groups/:id/members/:userId). Same invalidation contour as adding:
 * the `["group", id]` prefix (roster + memberCount) and the inbox (removing YOURSELF drops the thread).
 */
export function useRemoveGroupMember() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<{ ok: true }, unknown, RemoveGroupMemberRequest>({
    mutationFn: (input) => api.removeGroupMember(input),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.groupInfo(vars.id) })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

/**
 * Promote/demote a member (PUT /groups/:id/members/:userId/role - "admin" | "member"; the single owner
 * is fixed at creation). Invalidates the `["group", id]` prefix so the roster's role badges refresh
 * (memberCount is untouched but the info read is cheap and the prefix keeps this hook simple).
 */
export function useSetGroupMemberRole() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<GroupMemberDTO, unknown, SetGroupMemberRoleRequest>({
    mutationFn: (input) => api.setGroupMemberRole(input),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.groupInfo(vars.id) })
    },
  })
}
