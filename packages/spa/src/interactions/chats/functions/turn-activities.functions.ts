/**
 * Grouping a chat's flat activity log by the turn each entry belongs to, in a
 * way the timeline's memoised rows can actually use.
 *
 * Grouping itself is three lines. The part that matters is what happens on the
 * *next* event: the reducer appends an activity by rebuilding the array
 * (`[...activities, next]`), so a naive regroup hands every turn a brand new
 * array, and every assistant row sees a changed prop and re-renders — one tool
 * call landing in the running turn re-renders (and re-parses the markdown of)
 * a two-hundred-message conversation.
 *
 * So this reconciles against the previous grouping and keeps the old array
 * whenever a turn's entries are unchanged. Activities are immutable values
 * produced by the reducer, so identity comparison is the right test: equal
 * identities mean the turn genuinely did not move. Only the turn that actually
 * gained an entry gets a new array, and only its row re-renders.
 *
 * Pure, so the reuse rule is testable without a socket.
 */
import type { ChatActivity } from "@byconvo/core/chats";

export type ActivitiesByTurn = ReadonlyMap<string, ReadonlyArray<ChatActivity>>;

/** Whether two groups hold the same entries, in the same order, by identity. */
const sameEntries = (
  a: ReadonlyArray<ChatActivity>,
  b: ReadonlyArray<ChatActivity>
): boolean => a.length === b.length && a.every((entry, i) => entry === b[i]);

/**
 * `activities` grouped by `turnId`, preserving the array identity a turn had in
 * `previous` when its entries have not changed. Pass an empty map on first use.
 */
export function groupActivitiesByTurn(
  activities: ReadonlyArray<ChatActivity>,
  previous: ActivitiesByTurn
): ActivitiesByTurn {
  const grouped = new Map<string, Array<ChatActivity>>();
  for (const activity of activities) {
    const group = grouped.get(activity.turnId);
    if (group === undefined) grouped.set(activity.turnId, [activity]);
    else group.push(activity);
  }

  const result = new Map<string, ReadonlyArray<ChatActivity>>();
  for (const [turnId, group] of grouped) {
    const before = previous.get(turnId);
    result.set(
      turnId,
      before !== undefined && sameEntries(before, group) ? before : group
    );
  }
  return result;
}
