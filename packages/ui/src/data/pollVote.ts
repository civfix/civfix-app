/**
 * applyVoteLocally (P6 Task 6.7) - the PURE optimistic-vote transform for a poll DTO. `chat.votePoll`
 * snapshots the poll, applies this, calls the server, and rolls back on error (the same
 * snapshot->patch->settle shape as toggleReaction / edit). Extracted so the counter arithmetic
 * unit-tests without React (package convention: pure-logic vitest).
 *
 * The math, per option:
 *   - a choice the viewer is ADDING (not mine before, mine now):     count + 1, mine = true
 *   - a choice the viewer is DROPPING (mine before, not mine now):   count - 1, mine = false
 *   - unchanged options keep their count.
 *
 * totalVoters counts DISTINCT voters, so it moves only when the viewer's PARTICIPATION flips:
 *   - first vote (had no vote, now voting):    + 1
 *   - full retract (had a vote, now empty):    - 1
 *   - switching / adding within an existing vote leaves totalVoters unchanged.
 *
 * Counts/voters are floored at 0 (defensive against a stale snapshot); myVote becomes the new idx list.
 */
import type { PollDTO } from "@civfix/shared"

/**
 * Return a new PollDTO reflecting the viewer voting for exactly `newIdxs` (an empty array = retract).
 *
 * @param poll     The current poll payload (the optimistic base).
 * @param newIdxs  The option idxs the viewer is now voting for (empty = un-vote).
 * @param hadVoted Whether the viewer had a vote BEFORE this change (poll.myVote.length > 0).
 */
export function applyVoteLocally(poll: PollDTO, newIdxs: number[], hadVoted: boolean): PollDTO {
  const chosen = new Set(newIdxs)
  const options = poll.options.map((o) => {
    const nowMine = chosen.has(o.idx)
    let count = o.count
    if (o.mine && !nowMine) count -= 1
    else if (!o.mine && nowMine) count += 1
    return { ...o, mine: nowMine, count: Math.max(0, count) }
  })

  const nowVoting = newIdxs.length > 0
  let totalVoters = poll.totalVoters
  if (!hadVoted && nowVoting) totalVoters += 1
  else if (hadVoted && !nowVoting) totalVoters = Math.max(0, totalVoters - 1)

  return { ...poll, options, myVote: [...newIdxs], totalVoters }
}
